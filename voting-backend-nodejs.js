// Import required modules
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, Token } = require('@solana/spl-token');
const crypto = require('crypto');
const twilio = require('twilio');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database mock (in a real app, you would use a proper database)
const db = {
    // Store OTPs with expiry time
    otps: {},
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

// Initialize Twilio client (replace with your credentials)
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

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

// Generate and send OTP
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid phone number format. Please provide a 10-digit number.' 
            });
        }
        
        // Check if user has already voted
        if (db.votedUsers.has(phone)) {
            return res.status(403).json({ 
                success: false, 
                message: 'You have already cast your vote for this election.' 
            });
        }
        
        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP with 5-minute expiry
        db.otps[phone] = {
            code: otp,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
        };
        
        // In a real application, send OTP via SMS
        // For development, just log it
        console.log(`OTP for ${phone}: ${otp}`);
        
        // Uncomment for production to send actual SMS
        /*
        await twilioClient.messages.create({
            body: `Your OTP for College Hostel Secretary Election is: ${otp}. Valid for 5 minutes.`,
            from: twilioPhoneNumber,
            to: `+${phone}`
        });
        */
        
        res.json({ 
            success: true, 
            message: 'OTP sent successfully.' 
        });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send OTP. Please try again.' 
        });
    }
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ 
                success: false, 
                message: 'Phone number and OTP are required.' 
            });
        }
        
        const storedOTP = db.otps[phone];
        
        // Check if OTP exists and is valid
        if (!storedOTP) {
            return res.status(400).json({ 
                success: false, 
                message: 'OTP not found. Please request a new one.' 
            });
        }
        
        // Check if OTP has expired
        if (storedOTP.expiresAt < Date.now()) {
            delete db.otps[phone]; // Clean up expired OTP
            return res.status(400).json({ 
                success: false, 
                message: 'OTP has expired. Please request a new one.' 
            });
        }
        
        // Check if OTP matches
        if (storedOTP.code !== otp) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid OTP. Please try again.' 
            });
        }
        
        // OTP is valid, generate a session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        // Clean up used OTP
        delete db.otps[phone];
        
        res.json({ 
            success: true, 
            message: 'OTP verified successfully.',
            sessionToken
        });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to verify OTP. Please try again.' 
        });
    }
});

// Cast a vote and record it on the blockchain
app.post('/api/vote', async (req, res) => {
    try {
        const { phone, candidate, sessionToken } = req.body;
        
        if (!phone || !candidate || !sessionToken) {
            return res.status(400).json({ 
                success: false, 
                message: 'Phone number, candidate, and session token are required.' 
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
        if (db.votedUsers.has(phone)) {
            return res.status(403).json({ 
                success: false, 
                message: 'You have already cast your vote for this election.' 
            });
        }
        
        // Record the vote on the blockchain
        let transaction;
        try {
            // In a real application, you would:
            // 1. Create a transaction that calls your voting program
            // 2. Include the candidate selection and voter ID (hashed for privacy)
            // 3. Sign and send the transaction
            
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
            
            // Add a memo with the vote data (in a real app, use a proper program instruction)
            /*
            transaction.add(
                new TransactionInstruction({
                    keys: [{ pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true }],
                    programId: VOTING_PROGRAM_ID,
                    data: Buffer.from(JSON.stringify({
                        action: 'vote',
                        candidate,
                        voterHash: crypto.createHash('sha256').update(phone).digest('hex')
                    }))
                })
            );
            */
            
            // Sign and send the transaction
            transaction.recentBlockhash = (await solanaConnection.getRecentBlockhash()).blockhash;
            transaction.feePayer = adminKeypair.publicKey;
            transaction.sign(adminKeypair);
            
            const signature = await solanaConnection.sendRawTransaction(transaction.serialize());
            await solanaConnection.confirmTransaction(signature);
            
            console.log(`Vote recorded on blockchain with signature: ${signature}`);
            
            // Mark the user as having voted
            db.votedUsers.add(phone);
            
            // Update vote count (for admin reporting)
            db.voteResults[candidate]++;
            
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
app.get('/api/check-voted/:phone', (req, res) => {
    try {
        const { phone } = req.params;
        
        if (!phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Phone number is required.' 
            });
        }
        
        const hasVoted = db.votedUsers.has(phone);
        
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

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;
