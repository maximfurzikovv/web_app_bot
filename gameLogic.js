let board = null;
let game = new Chess();
const socket = io('https://8b6f-2a09-bac5-5152-632-00-9e-19.ngrok-free.app');

// Цвета для подсветки клеток
const whiteSquareGrey = '#a9a9a9';
const blackSquareGrey = '#696969';
const urlParams = new URLSearchParams(window.location.search);
let roomCode = urlParams.get('roomCode');

if (roomCode) {
    roomCode = roomCode.split('/')[0];
}

function removeGreySquares() {
    $('#board .square-55d63').css('background', '');
}

function greySquare(square) {
    const $square = $('#board .square-' + square);
    let background = whiteSquareGrey;
    if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey;
    }
    $square.css('background', background);
}

// Проверка загрузки DOM
$(document).ready(function () {
    console.log('DOM загружен');

    // Инициализация шахматной доски
    board = ChessBoard('board', {
        draggable: true,
        dropOffBoard: 'trash',
        sparePieces: true,
        orientation: 'white',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare,
        onSnapEnd: onSnapEnd
    });


    socket.on('connect_error', (err) => console.error('Ошибка подключения:', err));

    // Получение информации о цвете игрока
    let playerColor = null;
    let gameReady = false;
    socket.on('playerColor', function (color) {
        playerColor = color;
        console.log(`Игрок получил цвет: ${color}`);

        // В зависимости от цвета, меняется ориентацию доски
        if (playerColor === 'b') {
            board.orientation('black');
        } else {
            board.orientation('white');
        }
    });

    socket.on('gameReady', function () {
        $('#startBtn').prop('disabled', false);
        $('#startBtn').text('Начать игру');
        console.log('Игра готова, оба игрока подключены.');
    });
    gameReady = true;
    socket.on('error', function (message) {
        alert(message);
    });

// Отправка хода на сервер
    function sendMove(move) {
        socket.emit('move', {gameId: roomCode, move: move});
    }

    socket.on('updateBoard', function (fen) {
        game.load(fen);
        board.position(fen);
        console.log('Доска обновлена:', fen);
        updateStatus();
    });

    socket.on('updateHistory', function (history) {
        renderMoveHistory(history);
    });

    // Функция для обработки начала перетаскивания фигуры
    function onDragStart(source, piece, position, orientation) {

        // Проверка, если цвет игрока не совпадает с его возможным ходом
        if ((game.turn() === 'w' && playerColor !== 'w') ||
            (game.turn() === 'b' && playerColor !== 'b')) {
            return false; // Запрет на перетаскивание
        }

        // Запрет на перетаскивание фигур другого цвета
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }

        if (game.game_over()) return false;
    }

    // Функция для обработки хода
    function onDrop(source, target) {
        removeGreySquares();

        let move = game.move({
            from: source,
            to: target,
            promotion: 'q'
        });

        if (move === null) return 'snapback';
        console.log('Ход сделан:', move);

        sendMove(move);
        socket.emit('move', {gameId: roomCode, move});
        updateStatus(); // Обновить статус игры
        renderMoveHistory(game.history());
    }

    function onSnapEnd() {
        board.position(game.fen());
    }

    // Обработка наведения мыши на клетку
    function onMouseoverSquare(square, piece) {
        if ((playerColor === 'w' && piece && piece.search(/^b/) !== -1) ||
            (playerColor === 'b' && piece && piece.search(/^w/) !== -1)) {
            return;
        }

        const moves = game.moves({
            square: square,
            verbose: true
        });

        if (moves.length === 0) return;

        greySquare(square);

        for (let i = 0; i < moves.length; i++) {
            if (moves[i].flags.includes('c')) {
                $('#board .square-' + moves[i].to).css('background', 'red');
            } else {
                greySquare(moves[i].to);
            }
        }
    }

    function onMouseoutSquare(square, piece) {
        removeGreySquares();
    }

    // Обновление статуса игры
    function updateStatus() {
        let status = '';
        let moveColor = game.turn() === 'w' ? 'White' : 'Black';

        // Проверка на мат
        if (game.in_checkmate()) {
            status = 'Game over, ' + moveColor + ' is in checkmate.';
        } else if (game.in_draw()) {
            status = 'Game over, drawn position';
        } else {
            status = moveColor + ' to move';
            if (game.in_check()) {
                status += ', ' + moveColor + ' is in check';
            }
        }
        console.log('Текущий статус:', status);
        $('#status').text(status);

    }

    // Отображение истории ходов
    function renderMoveHistory(moves) {
        const historyElement = $('#move-history');
        historyElement.empty();
        const start = Math.max(0, moves.length - 5);
        const recentMoves = moves.slice(start);

        const formattedMoves = [];
        for (let i = 0; i < recentMoves.length; i++) {
            const moveIndex = start + i;
            const isWhiteMove = moveIndex % 2 === 0;

            const moveColor = isWhiteMove ? 'white-move' : 'black-move';
            let currentMove = recentMoves[i];

            if (currentMove.includes('x')) {
                currentMove += ' - ВЗЯТИЕ';
            }
            if (isWhiteMove) {
                formattedMoves.push(`<li class="${moveColor}">. White - ${currentMove}</li>`);
            } else {
                formattedMoves.push(`<li class="${moveColor}">. Black - ${currentMove}</li>`);
            }
        }

        historyElement.html(formattedMoves.join(''));
    }

    // Обработчик для кнопки "Начать игру"
    $('#startBtn').on('click', function () {
        console.log('Кнопка "Начать новую игру" нажата');
        if (!gameReady) {
            alert('Ожидайте подключения второго игрока!');
            return;
        }

        $('#interface').hide();
        $('#game-container').show();
        $('#board-container').show();
        $('#history-container').show();
        $('#status').show();

        game.reset(); // Сбросить игру
        board.position('start');
        updateStatus();

        $('#toggle-history-btn').show();
        socket.emit('newGame');
        socket.emit('joinGame', roomCode);
    });


    document.getElementById('toggle-history-btn').addEventListener('click', function () {
        const historyPanel = document.getElementById('history-container');
        historyPanel.classList.toggle('open');
        $('#history-container').show()// Переключаем класс, который открывает или закрывает панель
    });

    $('#close-history-btn').on('click', function () {
        $('#history-container').removeClass('open'); // Скрыть панель
    });
    // Обработка хода от сервера
    socket.on('updateBoard', function (fen) {
        game.load(fen); // Новое состояние игры
        board.position(fen); // Обновление отображения доски
        console.log('Обновленное состояние доски:', fen);
        updateStatus();
        renderMoveHistory(game.history());
    });

    socket.emit('joinGame', roomCode);
});
