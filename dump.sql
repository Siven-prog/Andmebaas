-- ============================================
-- Library Database Schema for PostgreSQL
-- ============================================

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS book_copies;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS authors;

-- ============================================
-- Authors
-- ============================================
CREATE TABLE authors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    birth_year INT
);

-- ============================================
-- Genres
-- ============================================
CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ============================================
-- Books
-- ============================================
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    author_id INT NOT NULL REFERENCES authors(id),
    genre_id INT NOT NULL REFERENCES genres(id),
    edition VARCHAR(50)
);

-- ============================================
-- Users
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL
);

-- ============================================
-- Book copies
-- ============================================
CREATE TABLE book_copies (
    id SERIAL PRIMARY KEY,
    book_id INT NOT NULL REFERENCES books(id),
    barcode VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'available'
);

-- ============================================
-- Transactions
-- ============================================
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    copy_id INT NOT NULL REFERENCES book_copies(id),
    issue_date DATE NOT NULL,
    return_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'borrowed'
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_books_author ON books(author_id);
CREATE INDEX idx_book_copies_book ON book_copies(book_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_copy ON transactions(copy_id);
