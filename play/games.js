/* The Fencing Token Arcade path: every game, in learning order. status: live | soon (all 17 live since Nov 2026).
   The hub (/play/) draws the map from this list; each live game has its own folder with index.html + logic.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FT_ARCADE_PATH = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  return {
    acts: [
      { id: 'learns', name: 'Act 1', title: 'How AI learns', blurb: 'No background needed. Start here.' },
      { id: 'talks', name: 'Act 2', title: 'How language models talk', blurb: 'What a chatbot is really doing.' },
      { id: 'builds', name: 'Act 3', title: 'Building with AI', blurb: 'Search, tools and agents.' },
      { id: 'fences', name: 'Act 4', title: 'Fencing it', blurb: 'Keep AI agents safe.' },
    ],
    games: [
      { id: 'teach-the-machine', act: 'learns', title: 'Teach the Machine', teaches: 'Training data and labels', play: 'Sort examples, train a model, then spot poisoned data.', frame: 'sort', status: 'live' },
      { id: 'downhill', act: 'learns', title: 'Downhill', teaches: 'Loss and learning rate', play: 'Roll a ball to the lowest point. Steps too big overshoot.', frame: 'physics', status: 'live' },
      { id: 'husky-or-wolf', act: 'learns', title: 'Husky or Wolf?', teaches: 'What a model really looks at', play: 'Tap where the model looked. The heatmap says: snow.', frame: 'find', status: 'live' },
      { id: 'next-word', act: 'talks', title: 'Next Word', teaches: 'How language models predict', play: 'Guess the word the model picks next, then see the odds.', frame: 'pick', status: 'live' },
      { id: 'token-chop', act: 'talks', title: 'Token Chop', teaches: 'Tokens', play: 'Slice words the way a model sees them.', frame: 'find', status: 'live' },
      { id: 'the-dial', act: 'talks', title: 'The Dial', teaches: 'Temperature', play: 'Turn the dial, guess which output it made.', frame: 'physics', status: 'live' },
      { id: 'pack-the-suitcase', act: 'talks', title: 'Pack the Suitcase', teaches: 'The context window', play: 'Pack text into a fixed space. The oldest falls out.', frame: 'sort', status: 'live' },
      { id: 'real-or-fake', act: 'talks', title: 'Real or Fake?', teaches: 'Hallucination', play: 'Swipe real or fake on citations and quotes.', frame: 'cards', status: 'live' },
      { id: 'meaning-map', act: 'builds', title: 'Meaning Map', teaches: 'Embeddings', play: 'Place words near their neighbours on a map of meaning.', frame: 'sort', status: 'live' },
      { id: 'open-book', act: 'builds', title: 'Open Book', teaches: 'Retrieval (RAG)', play: 'Pick the best passages within a word budget.', frame: 'pick', status: 'live' },
      { id: 'five-librarians', act: 'builds', title: 'The Five Librarians', teaches: 'Types of RAG', play: 'Meet five ways to look things up, then send the right one.', frame: 'pick', status: 'live' },
      { id: 'plug-it-in', act: 'builds', title: 'Plug It In', teaches: 'Tools and MCP', play: 'Wire tools to an agent. One reaches for your keys.', frame: 'grid', status: 'live' },
      { id: 'be-the-agent', act: 'builds', title: 'Be the Agent', teaches: 'The agent loop', play: 'Finish a task in the fewest tool calls.', frame: 'grid', status: 'live' },
      { id: 'spot-the-injection', act: 'fences', title: 'Spot the Injection', teaches: 'Prompt injection', play: 'Find the hidden instruction in an email, page or README.', frame: 'find', status: 'live' },
      { id: 'close-the-room', act: 'fences', title: 'Close the Room', teaches: 'Sandboxing: stopping data leaks', play: 'Block every way data can leave before it escapes.', frame: 'grid', status: 'live' },
      { id: 'policy-engine', act: 'fences', title: 'Be the Policy Engine', teaches: 'Policy enforcement', play: 'Allow, Deny or Ask a human on each tool call.', frame: 'cards', status: 'live' },
      { id: 'sign-here', act: 'fences', title: 'Sign Here', teaches: 'Human approval', play: 'Approve requests as they pile up. Read carefully.', frame: 'cards', status: 'live' },
      { id: 'cheat-this-leaderboard', act: 'fences', title: 'Cheat This Leaderboard', teaches: 'Check authority where the action happens', play: 'Try every trick. The server says no.', frame: 'sandbox', status: 'live' },
    ],
  };
}));
