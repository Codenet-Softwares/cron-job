import dotenv from "dotenv";
import mysql2 from 'mysql2/promise';


dotenv.config();

  export const sql = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DBNAME,
    multipleStatements: true,
  });


(async () => {
  try {
    const connection = await sql.getConnection();
    console.log('✅ Database connected successfully');
    connection.release(); 
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error.message);
    process.exit(1); 
  }
})();
