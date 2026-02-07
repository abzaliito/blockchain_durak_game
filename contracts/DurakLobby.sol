// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 1. Интерфейсы (твои, для токенов)
interface IDurakChips {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IDurakXP {
    function mintReward(address to, uint256 amount) external;
}

contract DurakLobby {
    // 2. Ссылки на контракты токенов
    IDurakChips public chipsToken;
    IDurakXP public xpToken;
    
    address public owner; // Адрес сервера или админа, который сообщает о конце игры

    struct GameTable {
        uint256 id;
        string name;
        uint256 entryFee; // Ставка
        address[] players;
        bool isActive;
        uint256 totalPot; // Общий банк стола
    }

    GameTable[] public tables;
    
    // События для фронтенда
    event TableCreated(uint256 tableId, string name, uint256 entryFee, address creator);
    event PlayerJoined(uint256 tableId, address player);
    event GameFinished(uint256 tableId, address winner, uint256 potWon);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    // 3. В конструкторе инициализируем адреса токенов
    constructor(address _chipsTokenAddress, address _xpTokenAddress) {
        owner = msg.sender;
        chipsToken = IDurakChips(_chipsTokenAddress);
        xpToken = IDurakXP(_xpTokenAddress);
    }

    // Создание стола (игрок платит фишки)
    function createTable(string memory _name, uint256 _entryFee) external {
        require(_entryFee > 0, "Fee must be > 0");

        // Забираем ставку у создателя
        require(chipsToken.transferFrom(msg.sender, address(this), _entryFee), "Transfer failed");

        address[] memory initialPlayers = new address[](1);
        initialPlayers[0] = msg.sender;

        tables.push(GameTable({
            id: tables.length,
            name: _name,
            entryFee: _entryFee,
            players: initialPlayers,
            isActive: true,
            totalPot: _entryFee
        }));

        emit TableCreated(tables.length - 1, _name, _entryFee, msg.sender);
    }

    // Отмена стола (если никто не присоединился)
    function cancelTable(uint256 _tableId) external {
        GameTable storage table = tables[_tableId];
        require(table.isActive, "Game not active");
        require(table.players.length == 1, "Players already joined"); // Только создатель
        require(table.players[0] == msg.sender, "Only creator can cancel");

        table.isActive = false;
        
        // Возврат ставки
        require(chipsToken.transfer(msg.sender, table.entryFee), "Refund failed");
        
        emit GameFinished(_tableId,  address(0), 0); // Событие закрытия стола (победитель = 0)
    }

    // Присоединение к столу
    function joinTable(uint256 _tableId) external {
        GameTable storage table = tables[_tableId];
        require(table.isActive, "Game not active");
        require(table.players.length < 6, "Table full"); // Максимум 6 игроков в Дураке

        // Забираем ставку у присоединившегося
        require(chipsToken.transferFrom(msg.sender, address(this), table.entryFee), "Transfer failed");

        table.players.push(msg.sender);
        table.totalPot += table.entryFee; // Увеличиваем банк

        emit PlayerJoined(_tableId, msg.sender);
    }

    function finishGame(uint256 _tableId, address _winner) external onlyOwner {
        GameTable storage table = tables[_tableId];
        require(table.isActive, "Game already finished");

        table.isActive = false; // Закрываем стол

        // 1. Отдаем весь банк победителю
        if (table.totalPot > 0) {
            chipsToken.transfer(_winner, table.totalPot);
        }

        // 2. Раздаем XP ВСЕМ игрокам за столом
        for (uint i = 0; i < table.players.length; i++) {
            xpToken.mintReward(table.players[i], 10 * 10**18); 
        }

        emit GameFinished(_tableId, _winner, table.totalPot);
    }

    // Вспомогательная функция, чтобы видеть игроков за столом
    function getPlayers(uint256 _tableId) external view returns (address[] memory) {
        return tables[_tableId].players;
    }
}