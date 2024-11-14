const express = require('express');
const http = require('http');
const socket = require('socket.io');
const path = require('path');
const Chess = require('chess.js').Chess;  // Подключение chess.js

const app = express();
const server = http.createServer(app);
const io = socket(server);

const PORT = process.env.PORT || 3000; // Укажите ваш порт или используйте порт по умолчанию

// Словарь для хранения активных игр
let games = {};
app.use(express.static(path.join(__dirname, 'public')));
io.on('connection', (socket) => {
    console.log('Новый игрок подключен:', socket.id);

    // Обработка события подключения к игре
    socket.on('joinGame', (gameId) => {
        if (!games[gameId]) {
            games[gameId] = {
                players: [],
                game: new Chess(),  // Создаем новый объект игры для каждого gameId
                boardState: null,
                playerColors: {}// Начальная позиция
            };
            games[gameId].game.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        }
 // Устанавливаем очередь хода черных, когда создается новая игра


        //
        // games[gameId].players.push(socket.id);
        // socket.join(gameId);
        //
        // // Отправка данных игрокам о текущем состоянии игры
        // // io.to(gameId).emit('updateBoard', games[gameId].boardState);
        // io.to(gameId).emit('updateBoard', games[gameId].game.fen());
        // console.log(`Игрок ${socket.id} присоединился к игре ${gameId}`);
        // Добавляем игрока в игру
        const game = games[gameId];

        // Проверяем, если игрок уже присоединился, избегаем дублирования
        if (game.players.includes(socket.id)) {
            console.log('Этот игрок уже присоединился к игре.');
            return;
        }

        // Присваиваем игроку цвет в зависимости от порядка подключения
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
    });

    // Обработка хода
    // socket.on('move', ({gameId, move}) => {
    //     // Логика обновления состояния игры с использованием chess.js
    //     if (games[gameId]) {
    //         const game = games[gameId].game; // Получаем объект игры
    //
    //         // Попытка сделать ход с использованием chess.js
    //         const chessMove = game.move(move); // Попытка выполнить ход
    //
    //         if (chessMove === null) {
    //             console.log('Некорректный ход');
    //             return;
    //         }
    //
    //         // Если ход успешен, отправляем новое состояние доски (в формате FEN) всем игрокам
    //         io.to(gameId).emit('updateBoard', game.fen());
    //     }
    // });
    // socket.on('move', ({gameId, move}) => {
    //     const game = games[gameId].game; // Получаем объект игры для этой игры
    //
    //     const chessMove = game.move(move); // Попытка выполнить ход
    //
    //     if (chessMove === null) {
    //         console.log('Некорректный ход');
    //         return;
    //     }
    //
    //     // Отправка обновленного состояния доски всем игрокам
    //     io.to(gameId).emit('updateBoard', game.fen());
    // });
    socket.on('move', ({gameId, move}) => {
        const game = games[gameId];
        if (game) {
            // Обновляем состояние игры
            const chessMove = game.game.move(move);
            if (chessMove === null) {
                console.log('Ошибка: Невалидный ход:', move);
                return; // Если ход невалиден, выходим
            }

            // Отправляем обновленное состояние игры всем участникам игры
            io.to(gameId).emit('updateBoard', game.game.fen()); // Отправляем новое состояние игры клиентам
            console.log('Новое состояние доски отправлено:', game.game.fen());
        }
    });

    // Обработка обновления состояния доски
    socket.on('updateBoard', function (fen) {
        game.load(fen); // Загружаем новое состояние игры
        board.position(fen); // Обновляем отображение доски
        updateStatus(); // Обновляем статус игры
    });

    // Обработка отключения игрока
    socket.on('disconnect', () => {
        console.log('Игрок отключен:', socket.id);
        // Удаление игрока из игры
        Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            if (game.players.includes(socket.id)) {
                game.players = game.players.filter(id => id !== socket.id);
                delete game.playerColors[socket.id];
            }
        });
    });
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
