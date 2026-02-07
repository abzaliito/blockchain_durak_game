// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "blockchain_durak_game/contracts/DurakToken.sol";

contract DurakLobby {
    // STRUCTS
    struct Campaign {
        address creator;        // The person who made the table
        string title;           // Table Name
        uint256 targetAmount;   // The Total Pot (Entry Fee * 2)
        uint256 currentFunds;   // How much is in the pot currently
        uint256 deadline;       // Time until table closes
        bool finalized;         // Game Over status
        address[] contributors; // Players at the table
    }

    // STATE VARIABLES
    DurakToken public rewardToken;
    uint256 public campaignCount = 0;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // EVENTS
    event CampaignCreated(uint256 indexed campaignId, string title, uint256 targetAmount, uint256 deadline);
    event ContributionReceived(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event GameStarted(uint256 indexed campaignId, address player1, address player2);
    event CampaignFinalized(uint256 indexed campaignId, address winner, uint256 payout);

    // INITIALIZATION
    constructor() {
        rewardToken = new DurakToken();
    }

    // Function 1: Create Table (Crowdfunding Campaign)
    function createCampaign(string memory _title, uint256 _durationSeconds) public payable {
        require(msg.value > 0, "Entry fee required to create table");

        uint256 goal = msg.value * 2; 
        uint256 deadline = block.timestamp + _durationSeconds;

        campaignCount++;
        Campaign storage newCamp = campaigns[campaignCount];
        newCamp.creator = msg.sender;
        newCamp.title = _title;
        newCamp.targetAmount = goal;
        newCamp.currentFunds = 0; 
        newCamp.deadline = deadline;
        newCamp.finalized = false;

        emit CampaignCreated(campaignCount, _title, goal, deadline);

        // Auto-contribute the creator's fee
        contribute(campaignCount); 
    }

    // Function 2: Join Table (Contribute)
    function contribute(uint256 _id) public payable {
        Campaign storage camp = campaigns[_id];

        require(block.timestamp < camp.deadline, "Table closed (Deadline passed)");
        require(!camp.finalized, "Game already finished");
        require(camp.currentFunds + msg.value <= camp.targetAmount, "Table is full!");

        // 1. Track Money
        camp.currentFunds += msg.value;
        contributions[_id][msg.sender] += msg.value;
        camp.contributors.push(msg.sender);

        // 2. Mint Reward Tokens (Calls Member 2's Logic)
        uint256 rewardAmount = msg.value * 1000;
        rewardToken.mint(msg.sender, rewardAmount);

        emit ContributionReceived(_id, msg.sender, msg.value);

        // 3. Check Game Start Condition
        if (camp.currentFunds >= camp.targetAmount) {
            address p1 = camp.contributors[0];
            address p2 = camp.contributors[1];
            emit GameStarted(_id, p1, p2);
        }
    }

    // Function 3: Payout Winner (Finalize)
    function finalizeCampaign(uint256 _id, address _winner) public {
        Campaign storage camp = campaigns[_id];
        require(!camp.finalized, "Already paid out");
        
        // Security check (Simple version for exam)
        require(msg.sender == camp.creator || contributions[_id][msg.sender] > 0, "Not authorized");
        
        camp.finalized = true;

        // Transfer the pot to the winner
        payable(_winner).transfer(camp.currentFunds);

        emit CampaignFinalized(_id, _winner, camp.currentFunds);
    }
    
    // Helper to see funds in contract
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}