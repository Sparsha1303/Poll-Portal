const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser'); // Import cookie-parser



const app = express();
app.use(bodyParser.json());

// app.use(cors({ origin: 'https://6b91-135-180-185-2.ngrok-free.app' }));
app.use(cors());

app.use(cookieParser());
mongoose.connect('mongodb://localhost:27017/polls');

const pollSchema = new mongoose.Schema({
  question: String,
  options: [String],
  state: String,
responses: { type: [Number], default: [] }});

const Poll = mongoose.model('Poll', pollSchema);

// async function cleanUp() {
//   await Poll.updateMany({}, { $set: { responses: [] } });
//   console.log('Database cleaned up');
//   process.exit();
// }


// cleanUp().catch(err => {
//   console.error('Error cleaning up database:', err);
//   process.exit(1);
// });
app.post('/createPoll', async (req, res) => {
  try {
    const { question, options } = req.body;
    const poll = new Poll({
      question,
      options,
      state: 'not_started',
      responses: [] // Initialize as an empty array
    });
    await poll.save();
    res.json({ pollId: poll._id });
  } catch (err) {
    console.error('Error creating poll:', err);
    res.status(500).json({ message: err.message });
  }
});




app.post('/startPoll', async (req, res) => {
  try {
    const { pollId } = req.body;
    await Poll.findByIdAndUpdate(pollId, { state: 'started' });
    res.sendStatus(200);
  } catch (err) {
    console.error('Error starting poll:', err);
    res.status(500).json({ message: err.message });
  }
});


// app.post('/endPoll', async (req, res) => {
//   try {
//     const { pollId } = req.body;
//     await Poll.findByIdAndUpdate(pollId, { state: 'ended' });
//     res.sendStatus(200);
//   } catch (err) {
//     console.error('Error ending poll:', err);
//     res.status(500).json({ message: err.message });
//   }
// });
app.post('/endPoll', async (req, res) => {
  try {
    const { pollId } = req.body;
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }
    poll.state = 'ended';
    await poll.save();
    res.json({ message: 'Poll ended successfully' });
  } catch (err) {
    console.error('Error ending poll:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/recordResponse', async (req, res) => {
  try {
    const { pollId, optionIndex } = req.body;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    const userCookie = req.cookies[`voted_${pollId}`];
    if (userCookie) {
      return res.status(400).json({ message: 'You have already voted in this poll.' });
    }

    if (poll.state === 'started') {
      // Ensure the responses array has enough space
      while (poll.responses.length <= optionIndex) {
        poll.responses.push(0); // Initialize new slots with 0
      }

      // Increment the response count for the selected option
      poll.responses[optionIndex] = (poll.responses[optionIndex] || 0) + 1;
      await poll.save();

      res.cookie(`voted_${pollId}`, true, { maxAge: 24 * 60 * 60 * 1000 }); // Set cookie for 24 hours
      res.json({ message: 'OK' }); // Send JSON response
    } else {
      res.status(400).json({ message: 'Poll is not active' });
    }
  } catch (err) {
    console.error('Error recording response:', err);
    res.status(500).json({ message: err.message });
  }
});







app.get('/poll/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).json({ message: 'Invalid poll ID' });
    }
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }
    res.json(poll);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




app.get('/pollResponses/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }
    const responses = poll.responses.map((count, index) => ({
      option: poll.options[index],
      count,
    }));
    res.json({ responses });
  } catch (err) {
    console.error('Error fetching poll responses:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.use(express.static(path.join(__dirname, '../public')));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
