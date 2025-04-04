// Import required modules
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const crypto = require('crypto');
const WebSocket = require('ws');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Initialize WebSocket server
const wss = new WebSocket.Server({ port: 3001 });

// WebSocket connections store
const clients = new Set();

// Broadcast vote updates to all connected clients
function broadcastVoteUpdate() {
    const voteData = JSON.stringify({
        type: 'voteUpdate',
        data: db.voteResults
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(voteData);
        }
    });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    clients.add(ws);
    
    // Send initial vote counts
    ws.send(JSON.stringify({
        type: 'voteUpdate',
        data: db.voteResults
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'vote') {
                // Update vote count
                if (db.voteResults.hasOwnProperty(data.candidate)) {
                    db.voteResults[data.candidate]++;
                    
                    // Broadcast update to all clients
                    broadcastVoteUpdate();
                }
            } else if (data.type === 'getVoteCounts') {
                // Send current vote counts to the requesting client
                ws.send(JSON.stringify({
                    type: 'voteUpdate',
                    data: db.voteResults
                }));
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(ws);
    });
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database mock (in a real app, you would use a proper database)
const db = {
    // Store voted users to prevent duplicate votes
    votedUsers: new Set(),
    // Store vote counts (for admin reporting)
    voteResults: {
        "Alice": 0,
        "Bob": 0,
        "Charlie": 0,
        "David": 0,
        "Eve": 0
    }
};

// Initialize Solana connection
const solanaConnection = new Connection(
    process.env.SOLANA_NETWORK || 'https://api.devnet.solana.com',
    'confirmed'
);

// Admin keypair for transaction signing (in production, use secure key management)
// The private key should NEVER be hardcoded in a real application
let adminKeypair;
try {
    // In production, this would be loaded from a secure environment variable or key management service
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (adminPrivateKey) {
        const secretKey = new Uint8Array(JSON.parse(adminPrivateKey));
        adminKeypair = Keypair.fromSecretKey(secretKey);
    } else {
        // For development only - generate a new keypair
        adminKeypair = Keypair.generate();
        console.log("Generated temporary admin keypair. In production, use a secure key.");
    }
} catch (error) {
    console.error("Failed to initialize admin keypair:", error);
    adminKeypair = Keypair.generate(); // Fallback for dev
}

// Program ID for the custom voting program on Solana
// In a real app, you would deploy a custom program and use its public key
const VOTING_PROGRAM_ID = new PublicKey(
    process.env.VOTING_PROGRAM_ID || '11111111111111111111111111111111' // Placeholder
);

// Validate college email
function validateCollegeEmail(email) {
    // Check basic email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return false;
    }
    
    // Check for college domain (customize this for your college)
    // This could check for .edu domains or specific college domains
    return email.endsWith('.edu') || email.includes('college.edu');
}

// Authenticate with college email
app.post('/api/auth/email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !validateCollegeEmail(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email format. Please provide a valid college email address.' 
            });
        }
        
        // Check if user has already voted
        if (db.votedUsers.has(email)) {
            return res.status(403).json({ 
                success: false, 
                message: 'You have already cast your vote for this election.' 
            });
        }
        
        // In a real application, you might:
        // 1. Check against a database of enrolled students
        // 2. Verify the email is active in your college system
        // 3. Log the authentication attempt for security
        
        // Generate a session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        res.json({ 
            success: true, 
            message: 'Authentication successful.',
            sessionToken
        });
    } catch (error) {
        console.error('Error authenticating email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to authenticate. Please try again.' 
        });
    }
});

// Cast a vote and record it on the blockchain
app.post('/api/vote', async (req, res) => {
    try {
        const { email, candidate, sessionToken } = req.body;
        
        if (!email || !candidate || !sessionToken) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, candidate, and session token are required.' 
            });
        }
        
        // Validate email
        if (!validateCollegeEmail(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email format.' 
            });
        }
        
        // Validate candidate
        const validCandidates = ["Alice", "Bob", "Charlie", "David", "Eve"];
        if (!validCandidates.includes(candidate)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid candidate selection.' 
            });
        }
        
        // In a real app, verify the session token
        // For this demo, we'll skip detailed token validation
        
        // Check if user has already voted
        if (db.votedUsers.has(email)) {
            return res.status(403).json({ 
                success: false, 
                message: 'You have already cast your vote for this election.' 
            });
        }
        
        // Record the vote on the blockchain
        let transaction;
        try {
            // Create a simple transaction (placeholder)
            transaction = new Transaction();
            
            // For demo purposes, we'll just use a transfer instruction as a placeholder
            // In a real application, you would call your custom program
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: adminKeypair.publicKey,
                    toPubkey: adminKeypair.publicKey, // sending to self as a placeholder
                    lamports: 100, // minimal amount
                })
            );
            
            // Sign and send the transaction
            transaction.recentBlockhash = (await solanaConnection.getRecentBlockhash()).blockhash;
            transaction.feePayer = adminKeypair.publicKey;
            transaction.sign(adminKeypair);
            
            const signature = await solanaConnection.sendRawTransaction(transaction.serialize());
            await solanaConnection.confirmTransaction(signature);
            
            console.log(`Vote recorded on blockchain with signature: ${signature}`);
            
            // Mark the user as having voted
            db.votedUsers.add(email);
            
            // Update vote count (for admin reporting)
            db.voteResults[candidate]++;
            
            // Broadcast the update to all connected clients
            broadcastVoteUpdate();
            
            res.json({ 
                success: true, 
                message: 'Vote cast successfully.',
                signature
            });
        } catch (error) {
            console.error('Blockchain error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to record vote on the blockchain. Please try again.' 
            });
        }
    } catch (error) {
        console.error('Error casting vote:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to cast vote. Please try again.' 
        });
    }
});

// Check if a user has already voted
app.get('/api/check-voted/:email', (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required.' 
            });
        }
        
        const hasVoted = db.votedUsers.has(email);
        
        res.json({ 
            success: true, 
            hasVoted
        });
    } catch (error) {
        console.error('Error checking vote status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to check vote status.' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Add new endpoint to get current vote counts
app.get('/api/vote-counts', (req, res) => {
    res.json({
        success: true,
        data: db.voteResults
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;
