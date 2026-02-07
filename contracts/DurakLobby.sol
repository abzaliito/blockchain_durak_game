// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Импорт твоего файла с токенами
import "./DurakToken.sol";

contract DurakLobby {
    // Ссылки на твои контракты токенов
    DurakChips public chipsToken;
    DurakXP public xpToken;

    struct Game {
        address creator;
        uint256 betAmount;
        address[] players;
        bool isActive;
        bool finalized;
    }

    uint256 public gameCount;
    mapping(uint256 => Game) public games;

    // Конструктор принимает адреса УЖЕ созданных токенов
    constructor(address _chipsAddr, address _xpAddr) {
        chipsToken = DurakChips(_chipsAddr);
        xpToken = DurakXP(_xpAddr);
    }

    // Создание стола со ставкой в фишках DRC
    function createTable(uint256 _bet) external {
        // Игрок должен сначала вызвать approve в контракте фишек
        chipsToken.transferFrom(msg.sender, address(this), _bet);

        gameCount++;
        Game storage newGame = games[gameCount];
        newGame.creator = msg.sender;
        newGame.betAmount = _bet;
        newGame.players.push(msg.sender);
        newGame.isActive = true;
    }

    // Присоединиться к игре
    function joinTable(uint256 _id) external {
        Game storage game = games[_id];
        require(game.isActive, "Game not active");
        
        chipsToken.transferFrom(msg.sender, address(this), game.betAmount);
        game.players.push(msg.sender);
    }

    // Завершить игру: выплата победителю и МИНТИНГ ОПЫТА (Requirement 3.3)
    function finishGame(uint256 _id, address _winner) external {
        Game storage game = games[_id];
        require(game.isActive && !game.finalized, "Game already over");
        
        game.finalized = true;
        game.isActive = false;

        // 1. Выплата банка победителю
        uint256 totalPot = game.betAmount * game.players.length;
        chipsToken.transfer(_winner, totalPot);

        // 2. Автоматический минтинг наградных токенов XP для всех (Task 2)
        for (uint i = 0; i < game.players.length; i++) {
            xpToken.mintReward(game.players[i], 10 * 10**18); // 10 DXP каждому
        }
    }
}