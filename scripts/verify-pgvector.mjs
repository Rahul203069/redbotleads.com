import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const client = new Client({ connectionString });

try {
  await client.connect();

  const extension = await client.query(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );
  if (extension.rowCount !== 1) {
    throw new Error("The pgvector extension is not installed.");
  }

  const expectedColumns = [
    ["CampaignSemanticPlaygroundQuery", "embedding"],
    ["CampaignSemanticQuery", "embedding"],
    ["RedditItemEmbedding", "embedding"],
  ];
  const columns = await client.query(`
    SELECT c.relname AS table_name, a.attname AS column_name,
           format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname = 'embedding'
  `);
  const dimensions = new Map(
    columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row.data_type]),
  );
  for (const [table, column] of expectedColumns) {
    const actual = dimensions.get(`${table}.${column}`);
    if (actual !== "vector(1536)") {
      throw new Error(`${table}.${column} must be vector(1536); found ${actual ?? "missing"}.`);
    }
  }

  const approximateIndexes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (indexdef ILIKE '% USING hnsw %' OR indexdef ILIKE '% USING ivfflat %')
  `);
  if (approximateIndexes.rowCount > 0) {
    throw new Error(
      `Approximate vector indexes are not allowed for exact semantic-search parity: ${approximateIndexes.rows
        .map((row) => row.indexname)
        .join(", ")}`,
    );
  }

  await client.query("CREATE TEMP TABLE vector_parity_check (label text, embedding vector(3))");
  await client.query(`
    INSERT INTO vector_parity_check (label, embedding)
    VALUES ('exact', '[1,0,0]'), ('near', '[1,1,0]'), ('opposite', '[-1,0,0]')
  `);
  const ranking = await client.query(`
    SELECT label, 1 - (embedding <=> '[1,0,0]'::vector) AS score
    FROM vector_parity_check
    ORDER BY embedding <=> '[1,0,0]'::vector ASC
  `);
  const labels = ranking.rows.map((row) => row.label);
  if (labels.join(",") !== "exact,near,opposite") {
    throw new Error(`Unexpected cosine ranking: ${labels.join(",")}`);
  }

  const scores = ranking.rows.map((row) => Number(row.score));
  const expectedScores = [1, Math.SQRT1_2, -1];
  scores.forEach((score, index) => {
    if (Math.abs(score - expectedScores[index]) > 1e-12) {
      throw new Error(`Unexpected cosine score at position ${index}: ${score}`);
    }
  });

  console.log(
    `pgvector ${extension.rows[0].extversion} verified: 1536 dimensions, exact cosine ranking, no approximate indexes.`,
  );
} finally {
  await client.end().catch(() => undefined);
}
