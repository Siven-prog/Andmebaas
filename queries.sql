/* 1. Find all currently available books 
   Purpose: List books that have at least one available copy.
   Expected result: Books with available copies, grouped by title and genre.
   Note: "Available" copies are taken as those in book_copies with status = 'available'
*/
SELECT 
    b.title AS "Book Title",
    b.isbn AS "ISBN",
    b.edition AS "Edition",
    COUNT(bc.id) AS "Available Copies",
    g.name AS "Genre"
FROM books b
JOIN genres g ON b.genre_id = g.id
JOIN book_copies bc ON b.id = bc.book_id
WHERE bc.status = 'available'
GROUP BY b.id, b.title, b.isbn, b.edition, g.name
ORDER BY b.title;

/* 2. Find users who currently have books on loan 
   Purpose: Show users with active loan transactions.
   Expected result: List of users, borrowed books, loan dates, and due dates.
   Note: We assume users table replaces members, and transactions replaces loans.
         Books are linked via book_copies. Due date is calculated as issue_date + 30 days.
         Active loans are those with status = 'borrowed' and a NULL return_date.
*/
SELECT 
    u.name AS "Name",
    b.title AS "Book",
    t.issue_date AS "Loan Date",
    (t.issue_date + INTERVAL '30 days')::date AS "Due Date"
FROM users u
JOIN transactions t ON u.id = t.user_id
JOIN book_copies bc ON t.copy_id = bc.id
JOIN books b ON bc.book_id = b.id
WHERE t.status = 'borrowed'
  AND t.return_date IS NULL
ORDER BY t.issue_date;

/* 3. Find the most popular books in the last 12 months 
   Purpose: Identify top 10 books (with more than 5 loans) based on loan count within the last year.
   Expected result: Top 10 most borrowed books with loan counts.
   Note: Loan date is taken as transactions.issue_date.
*/
SELECT 
    b.title AS "Book",
    COUNT(t.id) AS "Number of Loans in Last Year"
FROM books b
JOIN book_copies bc ON bc.book_id = b.id
JOIN transactions t ON t.copy_id = bc.id
WHERE t.issue_date >= (CURRENT_DATE - INTERVAL '12 months')
GROUP BY b.id, b.title
HAVING COUNT(t.id) > 5
ORDER BY COUNT(t.id) DESC
LIMIT 10;

/* 4. Find active users who have borrowed more than 5 books 
   Purpose: Identify frequent borrowers.
   Expected result: List of users with their total and active (borrowed) loan counts.
   Note: Active loans are computed from transactions where status = 'borrowed'.
*/
SELECT 
    u.id AS "User ID",
    u.name AS "Name",
    COUNT(t.id) AS "Total Loans",
    COUNT(CASE WHEN t.status = 'borrowed' THEN 1 END) AS "Active Loans"
FROM users u
JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.name
HAVING COUNT(t.id) > 5
ORDER BY COUNT(t.id) DESC;

/* 5. Find authors and the genres of their books 
   Purpose: List each author with their book titles and corresponding genres.
   Expected result: Authors listed with their books and genres, sorted by author name.
   Note: Use authors.name (since there is no first_name/last_name), and link books.author_id to authors.id.
*/
SELECT 
    a.name AS "Author Name",
    b.title AS "Book Title",
    g.name AS "Genre"
FROM authors a
JOIN books b ON a.id = b.author_id
JOIN genres g ON b.genre_id = g.id
ORDER BY a.name, b.title;

/* 6. Find users with overdue loans 
   Purpose: Identify users with loans overdue based on a 30-day loan period.
   Expected result: Users with overdue books, sorted by number of overdue days (highest first).
   Note: A loan is overdue if:
         - t.return_date IS NULL
         - (t.issue_date + INTERVAL '30 days') is before CURRENT_DATE.
         Overdue days is calculated as the difference between CURRENT_DATE and the due date.
*/
SELECT 
    u.name AS "Name",
    b.title AS "Book",
    (CURRENT_DATE - (t.issue_date + INTERVAL '30 days')::date)::INTEGER AS "Overdue Days"
FROM users u
JOIN transactions t ON u.id = t.user_id
JOIN book_copies bc ON t.copy_id = bc.id
JOIN books b ON bc.book_id = b.id
WHERE t.return_date IS NULL
  AND (t.issue_date + INTERVAL '30 days')::date < CURRENT_DATE
ORDER BY (CURRENT_DATE - (t.issue_date + INTERVAL '30 days')::date)::INTEGER DESC;
