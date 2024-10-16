;(function () {
  var $ = window['jQuery']
  var COLUMNS = 'abcdefgh'.split('')
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
  var START_POSITION = fen_to_obj(START_FEN)
  var CSS = {}
  CSS['alpha'] = 'alpha-d2270'
  CSS['black'] = 'black-3c85d'
  CSS['board'] = 'board-b72b1'
  CSS['chessboard'] = 'chessboard-63f37'
  CSS['clearfix'] = 'clearfix-7da63'
  CSS['notation'] = 'notation-322f9'
  CSS['numeric'] = 'numeric-fc462'
  CSS['piece'] = 'piece-417db'
  CSS['row'] = 'row-5277c'
  CSS['sparePieces'] = 'spare-pieces-7492f'
  CSS['sparePiecesBottom'] = 'spare-pieces-bottom-ae20f'
  CSS['sparePiecesTop'] = 'spare-pieces-top-4028b'
  CSS['square'] = 'square-55d63'
  CSS['white'] = 'white-1e1d7'

  function gen_uuid () {
    return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  }

  function deepCopy (thing) {
    return JSON.parse(JSON.stringify(thing))
  }

  function replaceTemplate (str, obj) {
    for (var key in obj) {
      str = str.replace(new RegExp(`{${key}}`, 'g'), obj[key]);
    }
    return str;
  }

  function isString (s) {
    return typeof s === 'string'
  }

  function isFunction (f) {
    return typeof f === 'function'
  }
 
  function fen_to_piececode (piece) {
    return (piece.toLowerCase() === piece ? 'b' : 'w') + piece.toUpperCase();
  }

  function piece_code_tofen (piece) {
    return (piece[0] === 'w' ? piece[1].toUpperCase() : piece[1].toLowerCase());
  }

  function fen_to_obj (fen) {
    var rows = fen.replace(/ .+$/, '').split('/'),
        position = {}, currentRow = 8;

    for (var row of rows) {
      var colIdx = 0;
      for (var char of row) {
        if (/[1-8]/.test(char)) {
          colIdx += parseInt(char, 10);
        } else {
          position[COLUMNS[colIdx++] + currentRow] = fen_to_piececode(char);
        }
      }
      currentRow--;
    }

    return position;
  }

  function obj_tofen (obj) {
    var fen = '', currentRow = 8;
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        var square = COLUMNS[j] + currentRow;
        fen += obj.hasOwnProperty(square) ? piece_code_tofen(obj[square]) : '1';
      }
      fen += (i !== 7 ? '/' : '');
      currentRow--;
    }
    return fen;
  }


  function createContainerHTML (hasSparePieces) {
    var html = '<div class="{chessboard}">'

    if (hasSparePieces) {
      html += '<div class="{sparePieces} {sparePiecesTop}"></div>'
    }

    html += '<div class="{board}"></div>'

    if (hasSparePieces) {
      html += '<div class="{sparePieces} {sparePiecesBottom}"></div>'
    }

    html += '</div>'

    return replaceTemplate(html, CSS)
  }

  function expandConfig (config) {
    if (config.orientation !== 'black') config.orientation = 'white'

    if (config.showNotation !== false) config.showNotation = true

    if (config.draggable !== true) config.draggable = false

    if (config.dropOffBoard !== 'trash') config.dropOffBoard = 'snapback'

    if (config.sparePieces !== true) config.sparePieces = false

    if (config.sparePieces) config.draggable = true

    if (!config.hasOwnProperty('pieceTheme') ||
        (!isString(config.pieceTheme) && !isFunction(config.pieceTheme))) {
      config.pieceTheme = '{piece}.jpeg'
    }

    return config
  }

  function checkContainerArg (containerElOrString) {
    if (!containerElOrString || !containerElOrString.startsWith('#')) {
      containerElOrString = `#${containerElOrString}`;
    }

    var $container = $(containerElOrString);
    if ($container.length !== 1) {
      window.alert('Chessboard Error: The first argument must be a valid DOM node or ID.');
      return false;
    }

    return $container;
  }

  function constructor(containerElOrString, config) {
    var $container = checkContainerArg(containerElOrString);
    if (!$container) return null;

    config = expandConfig(config);

    var widget = {},
        boardBorderSize = 2,
        currentOrientation = config.orientation || 'white',
        currentPosition = {},
        sparePiecesElsIds = {},
        squareElsIds = {},
        squareSize = 16;

    function setInitialState() {
        if (config.position === 'start') {
            currentPosition = deepCopy(START_POSITION);
        } else if (config.position) {
            error(7263, 'Invalid value passed to config.position.', config.position);
        }
    }

    function calculateSquareSize() {
        var containerWidth = parseInt($container.width(), 10);
        if (containerWidth <= 0) return 0;
        
        var boardWidth = containerWidth - 1;
        while (boardWidth % 8 !== 0 && boardWidth > 0) boardWidth--;
        return boardWidth / 8;
    }

    function createElIds() {
        COLUMNS.forEach((col, i) => {
            for (var j = 1; j <= 8; j++) {
                var square = col + j;
                squareElsIds[square] = square + '-' + gen_uuid();
            }
        });

        'KQRNBP'.split('').forEach(piece => {
            sparePiecesElsIds['w' + piece] = 'w' + piece + '-' + gen_uuid();
            sparePiecesElsIds['b' + piece] = 'b' + piece + '-' + gen_uuid();
        });
    }

    function create_BoardHTML(orientation = 'white') {
        var html = '',
            alpha = deepCopy(COLUMNS),
            row = (orientation === 'black') ? 1 : 8;

        if (orientation === 'black') alpha.reverse();

        for (var i = 0; i < 8; i++) {
            html += '<div class="{row}">';
            for (var j = 0; j < 8; j++) {
                var square = alpha[j] + row,
                    squareColor = (i + j) % 2 === 0 ? 'white' : 'black';
                html += `<div class="{square} ${CSS[squareColor]} square-${square}" style="width:${squareSize}px;height:${squareSize}px;" id="${squareElsIds[square]}" data-square="${square}">`;

                if (config.showNotation) {
                    if ((orientation === 'white' && row === 1) || (orientation === 'black' && row === 8)) {
                        html += `<div class="{notation} {alpha}">${alpha[j]}</div>`;
                    }
                    if (j === 0) {
                        html += `<div class="{notation} {numeric}">${row}</div>`;
                    }
                }

                html += '</div>';
            }
            html += '<div class="{clearfix}"></div></div>';
            row += (orientation === 'white') ? -1 : 1;
        }
        return replaceTemplate(html, CSS);
    }

    function createImg(piece) {
        if (isFunction(config.pieceTheme)) return config.pieceTheme(piece);
        if (isString(config.pieceTheme)) return replaceTemplate(config.pieceTheme, { piece });
        error(8272, 'Unable to build image source for config.pieceTheme.');
        return '';
    }

    function buildPieceHTML(piece, hidden, id) {
        return `<img src="${createImg(piece)}" ${id ? `id="${id}" ` : ''} alt="" class="{piece}" data-piece="${piece}" style="width:${squareSize}px;height:${squareSize}px;${hidden ? 'display:none;' : ''}" />`;
    }

    function buildSparePiecesHTML(color) {
        var pieces = (color === 'black') ? ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] : ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'];
        return pieces.map(piece => buildPieceHTML(piece, false, sparePiecesElsIds[piece])).join('');
    }

    function drawPositionInstant() {
        $board.find('.' + CSS.piece).remove();
        for (var square in currentPosition) {
            if (currentPosition.hasOwnProperty(square)) {
                $('#' + squareElsIds[square]).append(buildPieceHTML(currentPosition[square]));
            }
        }
    }

    function drawBoard() {
        $board.html(create_BoardHTML(currentOrientation));
        drawPositionInstant();
        if (config.sparePieces) {
            var topColor = currentOrientation === 'white' ? 'black' : 'white';
            $sparePiecesTop.html(buildSparePiecesHTML(topColor));
            $sparePiecesBottom.html(buildSparePiecesHTML(currentOrientation));
        }
    }

    widget.destroy = function () {
        $container.html('');
        if ($draggedPiece) $draggedPiece.remove();
        $container.unbind();
    };

    widget.fen = function () {
        return widget.position('fen');
    };

    widget.flip = function () {
        return widget.orientation('flip');
    };

    widget.orientation = function (arg) {
        if (arguments.length === 0) return currentOrientation;
        if (arg === 'white' || arg === 'black') {
            currentOrientation = arg;
            drawBoard();
            return currentOrientation;
        }
        if (arg === 'flip') {
            currentOrientation = (currentOrientation === 'white') ? 'black' : 'white';
            drawBoard();
            return currentOrientation;
        }
        error(5482, 'Invalid value passed to the orientation method.', arg);
    };

    widget.position = function (position, useAnimation) {
        if (arguments.length === 0) return deepCopy(currentPosition);
        if (position.toLowerCase() === 'fen') return obj_tofen(currentPosition);
        if (position.toLowerCase() === 'start') position = deepCopy(START_POSITION);
        if (useAnimation === undefined) useAnimation = true;

        if (useAnimation) {
            var animations = calculateAnimations(currentPosition, position);
            doAnimations(animations, currentPosition, position);
        } 
        setCurrentPosition(position);
        if (!useAnimation) drawPositionInstant();
    };

    widget.resize = function () {
        squareSize = calculateSquareSize();
        $board.css('width', squareSize * 8 + 'px');
        if ($draggedPiece) $draggedPiece.css({ height: squareSize, width: squareSize });
        if (config.sparePieces) {
            $container.find('.' + CSS.sparePieces).css('paddingLeft', squareSize + boardBorderSize + 'px');
        }
        drawBoard();
    };

    widget.start = function (useAnimation) {
        widget.position('start', useAnimation);
    };

    function stopDefault(evt) {
        evt.preventDefault();
    }

    function addEvents() {
        $('body').on('mousedown mousemove', '.' + CSS.piece, stopDefault);
    }

    function initDOM() {
        createElIds();
        $container.html(createContainerHTML(config.sparePieces));
        $board = $container.find('.' + CSS.board);

        if (config.sparePieces) {
            $sparePiecesTop = $container.find('.' + CSS.sparePiecesTop);
            $sparePiecesBottom = $container.find('.' + CSS.sparePiecesBottom);
        }

        var draggedPieceId = gen_uuid();
        $('body').append(buildPieceHTML('wP', true, draggedPieceId));
        $draggedPiece = $('#' + draggedPieceId);
        boardBorderSize = parseInt($board.css('borderLeftWidth'), 10);

        widget.resize();
    }

    setInitialState();
    initDOM();
    addEvents();

    return widget;
}

window['Chessboard'] = constructor;
window['ChessBoard'] = window['Chessboard'];
window['Chessboard']['fen_to_obj'] = fen_to_obj;
window['Chessboard']['obj_tofen'] = obj_tofen;

})()