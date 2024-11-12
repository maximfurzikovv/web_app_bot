// Объявление переменных для доски и игры
var board = null;
let game = new Chess(); // Создание экземпляра объекта игры с использованием chess.js

// Цвета для подсветки клеток
var whiteSquareGrey = '#a9a9a9';
var blackSquareGrey = '#696969';

// Функция для удаления подсветки клеток
function removeGreySquares() {
    $('#board .square-55d63').css('background', '');
}

// Функция для подсветки клетки
function greySquare(square) {
    var $square = $('#board .square-' + square);
    var background = whiteSquareGrey;
    if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey;
    }
    $square.css('background', background);
}

// Проверка загрузки DOM
$(document).ready(function () {
    console.log('DOM загружен');

    // Функция для обработки начала перетаскивания фигуры
    function onDragStart(source, piece, position, orientation) {
        // Запрет на перетаскивание, если игра окончена
        if (game.game_over()) return false;

        // Разрешить ходить только фигурам текущего игрока
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
    }

    // Функция для обработки хода
    function onDrop(source, target) {
        removeGreySquares();

        // Сделать ход в игре
        let move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Всегда превращать пешку в ферзя (упрощение)
        });

        // Если ход некорректный, вернуть фигуру на место
        if (move === null) return 'snapback';

        updateStatus(); // Обновить статус игры
        renderMoveHistory(game.history());
    }

    // Обновление позиции доски после завершения хода
    function onSnapEnd() {
        board.position(game.fen());
    }

    // Обработка наведения мыши на клетку
    function onMouseoverSquare(square, piece) {
        // Получить список всех возможных ходов для данной клетки
        var moves = game.moves({
            square: square,
            verbose: true
        });

        // Если нет возможных ходов, выйти
        if (moves.length === 0) return;

        // Подсветить клетку, на которую навели мышь
        greySquare(square);

        // Подсветить возможные ходы, включая взятие фигур
        for (var i = 0; i < moves.length; i++) {
            // Проверяем, является ли ход взятием
            if (moves[i].flags.includes('c')) {
                // Подсветка для взятия может быть другой
                $('#board .square-' + moves[i].to).css('background', 'red');
            } else {
                greySquare(moves[i].to);
            }
        }
    }

    // Обработка ухода мыши с клетки
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

        $('#status').text(status);

    }

    // Отображение истории ходов
    function renderMoveHistory(moves) {
        var historyElement = $('#move-history');
        historyElement.empty();

        var movesText = '';
        var formattedMoves = [];

        for (var i = 0; i < moves.length; i++) {
            // Определяем цвет игрока и форматируем ход
            var moveColor = (i % 2 === 0) ? 'white-move' : 'black-move';
            var currentMove = moves[i];

            // Если это взятие, добавляем подсветку и формат
            if (currentMove.includes('x')) {
                currentMove += ' - ВЗЯТИЕ';
            }

            formattedMoves.push('<li class="' + moveColor + '">');
            if (i % 2 === 0) {
                formattedMoves.push('White - ' + currentMove);
            } else {
                formattedMoves.push('Black - ' + currentMove);
            }
            formattedMoves.push('</li>');
        }

        historyElement.html(formattedMoves.join(''));
    }

    // Обработчик для кнопки "Начать новую игру"
    $('#startBtn').on('click', function () {
        console.log('Кнопка "Начать новую игру" нажата');
        $('#interface').hide();
        $('#board-container').show();
        $('#history-container').show();
        $('#status').show();
        // Инициализация шахматной доски
        board = ChessBoard('board', {
            draggable: true,
            position: 'start',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onMouseoverSquare: onMouseoverSquare,
            onMouseoutSquare: onMouseoutSquare,
            onSnapEnd: onSnapEnd
        });

        game.reset(); // Сбросить игру
        updateStatus(); // Обновить статус
    });

});