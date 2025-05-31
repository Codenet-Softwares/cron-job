import http from 'http';
import dotenv from 'dotenv';
import { sql } from './config/db.js';
import { updateLottery } from './Job Scheduler/lottery.cron.js';
import { updateColorGame } from './Job Scheduler/color.cron.js';

const envPath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';

dotenv.config({ path: envPath });     
console.log('Running in environment:', process.env.NODE_ENV);

console.log('Running in environment:', process.env.NODE_ENV);



const app = http.createServer();

app.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT || 6000}`);
  const runJob = async () => {
  try {
    await updateLottery();
     await updateColorGame();
  } catch (err) {
    console.error('Error in updateColorGame:', err.message);
  } finally {
    setTimeout(runJob, 1000); 
  }
};

runJob();
  
});

 process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  try {
    await sql.end(); 
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error closing DB connection:', error);
  }
  process.exit(0);
});