// This file contains the integration between the Node.js backend and the Solana blockchain

const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createVoteTransaction } = require('./solana-program');
const crypto = require('crypto');

/**
 * Handles the integration with the Solana blockchain
 * This would be imported and used by your Node.js backend
 */
class BlockchainService {
  constructor(networkUrl, programId, adminPrivateKey) {
    // Initialize Solana connection
    this.connection = new Connection(networkUrl, 'confirmed');
    
    // Set program ID
    this.programId = new PublicKey(programId);
    
    // Load admin keypair
    if (adminPrivateKey) {
      const secretKey = new Uint8Array(JSON.parse(adminPrivateKey));
      this.adminKeypair = Keypair.fromSecretKey(secretKey);
    } else {
      this.adminKeypair = Keypair.generate(); // For development only
    }
    
    // Initialize election accounts
    this.electionAccount = null;
    this.voterListAccount = null;
    
    console.log('Blockchain service initialized');
  }
  
  /**
   * Initialize the election accounts on the blockchain
   * This should be called once before the election starts
   */
  async initializeElection() {
    try {
      // In a real application, you would:
      // 1. Create accounts for the election data and voter list
      // 2. Call the setup election instruction
      
      // For demonstration purposes, we'll just generate keypairs
      this.electionAccount = Keypair.generate();
      this.voterListAccount = Keypair.generate();
      
      console.log('Election initialized on blockchain');
      console.log('Election account:', this.electionAccount.publicKey.toString());
      console.log('Voter list account:', this.voterListAccount.publicKey.toString());
      
      return {
        electionAccount: this.electionAccount.publicKey.toString(),
        voterListAccount: this.voterListAccount.publicKey.toString()
      };
    } catch (error) {
      console.error('Failed to initialize election:', error);
      throw new Error('Failed to initialize election on blockchain');
    }
  }
  
  /**
   * Record a vote on the blockchain
   * @param {string} email - The voter's college email
   * @param {string} candidate - The selected candidate's name
   * @returns {Promise<string>} - Transaction signature
   */
  async recordVote(email, candidate) {
    try {
      // Validate inputs
      if (!email || !candidate) {
        throw new Error('Email and candidate are required');
      }
      
      // Hash the email for privacy
      const voterHash = crypto.createHash('sha256').update(email).digest('hex');
      
      // Ensure election is initialized
      if (!this.electionAccount || !this.voterListAccount) {
        await this.initializeElection();
      }
      
      // Create and send the vote transaction
      const signature = await createVoteTransaction(
        this.connection,
        this.adminKeypair,
        this.programId,
        this.electionAccount.publicKey,
        this.voterListAccount.publicKey,
        candidate,
        voterHash
      );
      
      console.log(`Vote recorded on blockchain with signature: ${signature}`);
      return signature;
    } catch (error) {
      console.error('Failed to record vote on blockchain:', error);
      throw new Error('Failed to record vote on blockchain');
    }
  }
  
  /**
   * Close the election and finalize results
   * @returns {Promise<Object>} - Election results
   */
  async closeElection() {
    try {
      // In a real application, you would:
      // 1. Call the close election instruction
      // 2. Retrieve the final vote counts
      
      console.log('Election closed on blockchain');
      
      // For demonstration, return dummy results
      return {
        'Alice': 45,
        'Bob': 32,
        'Charlie': 28,
        'David': 15,
        'Eve': 30
      };
    } catch (error) {
      console.error('Failed to close election:', error);
      throw new Error('Failed to close election on blockchain');
    }
  }
  
  /**
   * Get the current election results
   * @returns {Promise<Object>} - Current vote counts
   */
  async getElectionResults() {
    try {
      // In a real application, you would:
      // 1. Fetch the election account data
      // 2. Deserialize the data to get vote counts
      
      console.log('Fetching election results from blockchain');
      
      // For demonstration, return dummy results
      return {
        'Alice': 21,
        'Bob': 18,
        'Charlie': 15,
        'David': 9,
        'Eve': 12
      };
    } catch (error) {
      console.error('Failed to get election results:', error);
      throw new Error('Failed to get election results from blockchain');
    }
  }
  
  /**
   * Verify if an email is eligible to vote
   * @param {string} email - The voter's college email
   * @returns {Promise<boolean>} - Whether the email is eligible
   */
  async isEligibleVoter(email) {
    try {
      // In a real application, you would:
      // 1. Check if the email is in the list of eligible voters
      // 2. Verify the email is a valid college email
      
      // For this demo, we'll just check if it's a college email format
      const isCollegeEmail = email.endsWith('.edu') || email.includes('college');
      
      return isCollegeEmail;
    } catch (error) {
      console.error('Failed to check voter eligibility:', error);
      throw new Error('Failed to verify voter eligibility');
    }
  }
}

module.exports = BlockchainService;
