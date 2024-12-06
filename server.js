const {Sequelize, DataTypes} = require('sequelize');
const express = require('express');
const http = require('http');
const socket = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const Chess = require('chess.js').Chess;

const app = express();
const server = http.createServer(app);
const io = socket(server);

const PORT = process.env.PORT || 5000;

// Подключение к базе данных
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'chess_game.db',
    logging: console.log,
});


app.use(express.static(path.join(__dirname, 'public')));

app.get('/webapp?roomCode', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function generateGameCode() {
    const randomNum = Math.floor(Math.random() * 1000000); // Генерируем случайное число
    return `${randomNum}`;
}

const GameState = sequelize.define('game_state', {
    game_code: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    board_state: {
        type: DataTypes.STRING,
        allowNull: false
    },
    game_in_progress: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    id_room_code: {
        type: DataTypes.STRING,
        references: {
            model: 'rooms',
            key: 'room_code'
        },
        allowNull: false
    }
}, {
    tableName: 'game_state',
    timestamps: false,
});

// Функция для сохранения состояния игры в базу данных
async function saveGameState(gameCode, boardState, roomCode) {
    try {
        if (!gameCode || !boardState || !roomCode) {
            console.error('Неверные данные для сохранения состояния игры.');
            return;
        }

        await GameState.upsert({
            game_code: gameCode,
            board_state: boardState,
            game_in_progress: true,
            id_room_code: roomCode
        });
        console.log(`Состояние игры для комнаты ${gameCode} успешно сохранено: ${boardState}`);
    } catch (error) {
        console.error("Ошибка при сохранении состояния игры:", error.message);
    }
}


// Функция для получения состояния игры из базы данных
async function getGameState(roomCode) {
    try {
        const roomCodeStr = String(roomCode);
        const game = await GameState.findOne({where: {id_room_code: roomCodeStr}});
        if (game) {
            console.log(`Состояние игры для комнаты ${roomCode} успешно получено: ${game.board_state}`);
            return game.board_state;
        }
        console.log(`Комната с кодом ${roomCode} не найдена.`);
        return null;
    } catch (error) {
        console.error("Ошибка при извлечении состояния игры:", error);
        return null;
    }
}

const games = {};

io.on('connection', (socket) => {
    console.log('Новый игрок подключен:', socket.id);

    // Обработка события подключения к игре
    socket.on('joinGame', async (gameId) => {
        if (!games[gameId]) {
            const gameCode = generateGameCode();
            games[gameId] = {
                players: [],
                game: new Chess(),
                boardState: null,
                playerColors: {},
                gameCode: gameCode
            };
            // Получение информации о комнате из базы данных
            const boardState = await getGameState(gameId);
            if (boardState) {
                console.log(`Комната с кодом ${gameId} найдена. Состояние доски загружено.`);
                const game = games[gameId] || {game: new Chess()};
                game.boardState = boardState;
                game.game.load(game.boardState);

                io.to(gameId).emit('updateBoard', game.game.fen());
            } else {
                console.log(`Комната с кодом ${gameId} не найдена. Создаем новую игру.`);
                const newGame = new Chess();
                games[gameId] = {
                    players: [],
                    game: new Chess(),
                    boardState: null,
                    playerColors: {},
                    gameCode: gameCode
                };

                io.to(gameCode).emit('updateBoard', newGame.fen());
            }
        }
        const currentGame = games[gameId];
        const game = games[gameId];

        if (game.players.includes(socket.id)) {
            console.log('Этот игрок уже присоединился к игре.');
            return;
        }

        if (game.players.length === 0) {
            game.playerColors[socket.id] = 'w';
            game.players.push(socket.id);
            socket.join(gameId);
            socket.emit('playerColor', 'w'); // Отправка информации о цвете
            console.log(`Игрок ${socket.id} присоединился к игре ${gameId} за белых.`);
        } else if (game.players.length === 1) {
            game.playerColors[socket.id] = 'b';
            game.players.push(socket.id);
            socket.join(gameId);
            socket.emit('playerColor', 'b'); // Отправка информации о цвете
            console.log(`Игрок ${socket.id} присоединился к игре ${gameId} за черных.`);
        }

        io.to(gameId).emit('updateBoard', game.game.fen());
        if (currentGame.players.length === 2) {
            io.to(gameId).emit('gameReady');
        }
    });

    socket.on('move', async ({gameId, move}) => {
        const game = games[gameId];

        console.log('Received move:', move);
        if (game) {
            try {
                const chessMove = game.game.move({
                    from: move.from,
                    to: move.to,
                    promotion: move.promotion || 'q',
                });

                if (chessMove === null) {
                    console.log('Ошибка: Невалидный ход:', move);
                    return;
                }

                const boardState = game.game.fen();
                await saveGameState(game.gameCode, boardState, gameId);

                // Отправляем новое состояние доски всем игрокам в комнате
                io.to(gameId).emit('updateBoard', game.game.fen());
                io.to(gameId).emit('updateHistory', game.game.history());

                console.log('Новое состояние доски отправлено:', game.game.fen());
            } catch (error) {
                console.error('Ошибка при выполнении хода:', error);
            }
        }
    });

    // Обработка отключения игрока
    socket.on('disconnect', () => {
        console.log('Игрок отключен:', socket.id);
        Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            if (game.players.includes(socket.id)) {
                game.players = game.players.filter(id => id !== socket.id);
                delete game.playerColors[socket.id];
            }
        });
    });
});

// Синхронизация базы данных и запуск сервера
(async () => {
    try {
        await sequelize.sync();
        console.log('База данных синхронизирована.');
        server.listen(PORT, () => {
            console.log(`Сервер запущен на порту ${PORT}`);
        });
    } catch (error) {
        console.error('Ошибка при запуске приложения:', error);
    }
})();
