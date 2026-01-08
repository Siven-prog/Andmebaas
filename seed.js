import { Client } from "pg";
import { faker } from "@faker-js/faker";
import * as dotenv from "dotenv";

dotenv.config();

// Seemne väärtus, et tulemused oleks korduvad
faker.seed(123);

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

const BATCH_SIZE = 5000;
const BOOK_COPIES_TARGET = 2_000_000;

// Batch insert funktsioon, erikohtlemine users tabelile
async function batchInsert(query, values) {
  let text;

  if (query.startsWith("INSERT INTO users")) {
    // Users — unikaalne email + ignore duplicate
    text = `${query} VALUES ${values
      .map(
        row =>
          `(${row
            .map(val =>
              val === null
                ? "NULL"
                : typeof val === "string"
                ? `'${val.replace(/'/g, "''")}'`
                : val
            )
            .join(",")})`
      )
      .join(",")} ON CONFLICT (email) DO NOTHING`;
  } else {
    text = `${query} VALUES ${values
      .map(
        row =>
          `(${row
            .map(val =>
              val === null
                ? "NULL"
                : typeof val === "string"
                ? `'${val.replace(/'/g, "''")}'`
                : val
            )
            .join(",")})`
      )
      .join(",")}`;
  }

  await client.query(text);
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

async function main() {
  await client.connect();

  console.log(">>> Temporarily dropping secondary indexes...");
  await client.query(`DROP INDEX IF EXISTS idx_books_author;`);
  await client.query(`DROP INDEX IF EXISTS idx_book_copies_book;`);
  await client.query(`DROP INDEX IF EXISTS idx_transactions_user;`);
  await client.query(`DROP INDEX IF EXISTS idx_transactions_copy;`);

  // 1. Authors
  console.log("Inserting authors...");
  for (let i = 0; i < 5000; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && i + j < 5000; j++) {
      batch.push([
        faker.person.fullName(),
        faker.date.birthdate({ min: 1900, max: 2000, mode: "year" }).getFullYear(),
      ]);
    }
    await batchInsert("INSERT INTO authors (name, birth_year)", batch);
  }

  // 2. Genres
  console.log("Inserting genres...");
  const genres = [
    "Fiction", "Non-Fiction", "Fantasy", "Science Fiction",
    "Mystery", "Thriller", "Romance", "Biography", "History", "Children"
  ];
  const genreValues = genres.map(g => [g]);
  await batchInsert("INSERT INTO genres (name)", genreValues);

  // 3. Books
  console.log("Inserting books...");
  const TOTAL_BOOKS = 50000;
  for (let i = 0; i < TOTAL_BOOKS; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && i + j < TOTAL_BOOKS; j++) {
      batch.push([
        faker.string.numeric(13), // ISBN
        faker.lorem.sentence(3).replace(/'/g, "''"), // title
        Math.floor(Math.random() * 5000) + 1, // author_id
        Math.floor(Math.random() * genres.length) + 1, // genre_id
        `${faker.number.int({ min: 1, max: 5 })}.${faker.number.int({ min: 0, max: 9 })}` // edition
      ]);
    }
    await batchInsert("INSERT INTO books (isbn, title, author_id, genre_id, edition)", batch);
  }

  // 4. Users (unikaalsed e-mailid)
  console.log("Inserting users...");
  const TOTAL_USERS = 20000;
  for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && i + j < TOTAL_USERS; j++) {
      const id = i + j + 1;
      batch.push([
        faker.person.fullName(),
        `user${id}@example.com`, // garanteeritud unikaalne e-mail
        faker.internet.password(),
        Math.random() < 0.05 ? "admin" : "user"
      ]);
    }
    await batchInsert("INSERT INTO users (name, email, password, role)", batch);
  }

  // 5. Book copies (≥2M)
  console.log("Inserting book copies...");
  for (let i = 0; i < BOOK_COPIES_TARGET; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && i + j < BOOK_COPIES_TARGET; j++) {
      batch.push([
        Math.floor(Math.random() * TOTAL_BOOKS) + 1, // book_id
        `BC${(i + j + 1).toString().padStart(7, "0")}`,
        "available"
      ]);
    }
    await batchInsert("INSERT INTO book_copies (book_id, barcode, status)", batch);
    if ((i / BATCH_SIZE) % 20 === 0)
      console.log(`   → ${i + BATCH_SIZE} / ${BOOK_COPIES_TARGET} book copies inserted`);
  }

  // 6. Transactions (parandatud user_id ja copy_id valik)
  console.log("Inserting transactions...");
  const TOTAL_TRANSACTIONS = 5_000_000;

  const usersCount = parseInt((await client.query("SELECT COUNT(*) FROM users")).rows[0].count);
  const copiesCount = parseInt((await client.query("SELECT COUNT(*) FROM book_copies")).rows[0].count);

  let inserted = 0;
  while (inserted < TOTAL_TRANSACTIONS) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && inserted + j < TOTAL_TRANSACTIONS; j++) {
      const issueDate = faker.date.between({ from: "2018-01-01", to: "2025-09-30" });
      const returnDate =
        Math.random() < 0.7
          ? faker.date.between({ from: issueDate, to: "2025-09-30" })
          : null;

      batch.push([
        Math.floor(Math.random() * usersCount) + 1,
        Math.floor(Math.random() * copiesCount) + 1,
        formatDate(issueDate),
        returnDate ? formatDate(returnDate) : null,
        returnDate ? "returned" : "borrowed",
      ]);
    }

    await batchInsert(
      "INSERT INTO transactions (user_id, copy_id, issue_date, return_date, status)",
      batch
    );
    inserted += batch.length;
    if (inserted % 100000 === 0)
      console.log(`   → ${inserted} / ${TOTAL_TRANSACTIONS} transactions inserted`);
  }

  console.log(">>> Restoring secondary indexes...");
  await client.query(`CREATE INDEX idx_books_author ON books(author_id);`);
  await client.query(`CREATE INDEX idx_book_copies_book ON book_copies(book_id);`);
  await client.query(`CREATE INDEX idx_transactions_user ON transactions(user_id);`);
  await client.query(`CREATE INDEX idx_transactions_copy ON transactions(copy_id);`);

  console.log(">>> Seeding completed!");

  // Kontrollime ridade arvu
  for (const table of ["authors", "genres", "books", "users", "book_copies", "transactions"]) {
    const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`${table}: ${res.rows[0].count} rows`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("Error:", err);
  client.end();
});
