"use strict";

// istanbul ignore next
var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

// istanbul ignore next
var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// Returns true if the specified string is a reserved word
exports.isReservedWord = isReservedWord;


// Returns true if the specified string is a strict mode reserved word
exports.isStrictReservedWord = isStrictReservedWord;
var _UnicodeJs = require("./Unicode.js");

var isIdentifierStart = _UnicodeJs.isIdentifierStart;
var isIdentifierPart = _UnicodeJs.isIdentifierPart;
var isWhitespace = _UnicodeJs.isWhitespace;
var codePointLength = _UnicodeJs.codePointLength;
var codePointAt = _UnicodeJs.codePointAt;
var codePointString = _UnicodeJs.codePointString;
var LineMap = require("./LineMap.js").LineMap;


var identifierEscape = /\\u([0-9a-fA-F]{4})/g,
    newlineSequence = /\r\n?|[\n\u2028\u2029]/g,
    crNewline = /\r\n?/g;

// === Reserved Words ===
var reservedWord = new RegExp("^(?:" + "break|case|catch|class|const|continue|debugger|default|delete|do|" + "else|enum|export|extends|false|finally|for|function|if|import|in|" + "instanceof|new|null|return|super|switch|this|throw|true|try|typeof|" + "var|void|while|with" + ")$");

var strictReservedWord = new RegExp("^(?:" + "implements|private|public|interface|package|let|protected|static|yield" + ")$");

// === Punctuators ===
var multiCharPunctuator = new RegExp("^(?:" + "--|[+]{2}|" + "&&|[|]{2}|" + "<<=?|" + ">>>?=?|" + "[!=]==|" + "=>|" + "[.]{2,3}|" + "::|" + "[-+&|<>!=*&^%/]=" + ")$");

// === Miscellaneous Patterns ===
var octalEscape = /^(?:[0-3][0-7]{0,2}|[4-7][0-7]?)/,
    blockCommentPattern = /\r\n?|[\n\u2028\u2029]|\*\//g,
    hexChar = /[0-9a-f]/i;

// === Character type lookup table ===
function makeCharTable() {
    var table = [];

    for (var i = 0; i < 128; ++i) {
        table[i] = "";
    }for (var i = 65; i <= 90; ++i) {
        table[i] = "identifier";
    }for (var i = 97; i <= 122; ++i) {
        table[i] = "identifier";
    }add("whitespace", "\t\u000b\f ");
    add("newline", "\r\n");
    add("decimal-digit", "123456789");
    add("punctuator-char", "{[]();,?");
    add("punctuator", "<>+-*%&|^!~=:");
    add("dot", ".");
    add("slash", "/");
    add("rbrace", "}");
    add("zero", "0");
    add("string", "'\"");
    add("template", "`");
    add("identifier", "$_\\");
    add("at", "@");

    return table;

    function add(type, string) {
        string.split("").forEach(function (c) {
            return table[c.charCodeAt(0)] = type;
        });
    }
}

var charTable = makeCharTable();

// Returns true if the character is a valid identifier part
function isIdentifierPartAscii(c) {
    return c > 64 && c < 91 || c > 96 && c < 123 || c > 47 && c < 58 || c === 36 || c === 95;
}

// Returns true if the specified character is a newline
function isNewlineChar(c) {
    switch (c) {

        case "\r":
        case "\n":
        case "\u2028":
        case "\u2029":
            return true;
    }

    return false;
}

// Returns true if the specified character can exist in a non-starting position
function isPunctuatorNext(c) {
    switch (c) {

        case "+":
        case "-":
        case "&":
        case "|":
        case "<":
        case ">":
        case "=":
        case ".":
        case ":":
            return true;
    }

    return false;
}function isReservedWord(word) {
    return reservedWord.test(word);
}function isStrictReservedWord(word) {
    return strictReservedWord.test(word);
}

var Scanner = exports.Scanner = (function () {
    function Scanner(input) {
        _classCallCheck(this, Scanner);

        this.input = input || "";
        this.offset = 0;
        this.length = this.input.length;
        this.lineMap = new LineMap();

        this.value = "";
        this.number = 0;
        this.regexFlags = "";
        this.templateEnd = false;
        this.newlineBefore = false;
        this.strictError = "";
        this.start = 0;
        this.end = 0;
    }

    _prototypeProperties(Scanner, null, {
        skip: {
            value: function skip() {
                return this.next("skip");
            },
            writable: true,
            configurable: true
        },
        next: {
            value: function next(context) {
                if (this.type !== "COMMENT") this.newlineBefore = false;

                this.strictError = "";

                do {
                    this.start = this.offset;

                    this.type = this.start >= this.length ? this.EOF() : context === "skip" ? this.Skip() : this.Start(context);
                } while (!this.type);

                this.end = this.offset;

                return this.type;
            },
            writable: true,
            configurable: true
        },
        rawValue: {

            // TODO:  Should this be put on ParseResult instead?
            value: function rawValue(start, end) {
                // Line endings are normalized to <LF>
                return this.input.slice(start, end).replace(crNewline, "\n");
            },
            writable: true,
            configurable: true
        },
        peekChar: {
            value: function peekChar() {
                return this.input.charAt(this.offset);
            },
            writable: true,
            configurable: true
        },
        peekCharAt: {
            value: function peekCharAt(n) {
                return this.input.charAt(this.offset + n);
            },
            writable: true,
            configurable: true
        },
        peekCodePoint: {
            value: function peekCodePoint() {
                return codePointAt(this.input, this.offset);
            },
            writable: true,
            configurable: true
        },
        peekCode: {
            value: function peekCode() {
                return this.input.charCodeAt(this.offset) | 0;
            },
            writable: true,
            configurable: true
        },
        peekCodeAt: {
            value: function peekCodeAt(n) {
                return this.input.charCodeAt(this.offset + n) | 0;
            },
            writable: true,
            configurable: true
        },
        readChar: {
            value: function readChar() {
                return this.input.charAt(this.offset++);
            },
            writable: true,
            configurable: true
        },
        readUnicodeEscapeValue: {
            value: function readUnicodeEscapeValue() {
                var hex = "";

                if (this.peekChar() === "{") {
                    this.offset++;
                    hex = this.readHex(0);

                    if (hex.length < 1 || this.readChar() !== "}") {
                        return null;
                    }
                } else {
                    hex = this.readHex(4);

                    if (hex.length < 4) {
                        return null;
                    }
                }

                return parseInt(hex, 16);
            },
            writable: true,
            configurable: true
        },
        readUnicodeEscape: {
            value: function readUnicodeEscape() {
                var cp = this.readUnicodeEscapeValue(),
                    val = codePointString(cp);

                return val === "" ? null : val;
            },
            writable: true,
            configurable: true
        },
        readIdentifierEscape: {
            value: function readIdentifierEscape(startChar) {
                this.offset++;

                if (this.readChar() !== "u") {
                    return null;
                }var cp = this.readUnicodeEscapeValue();

                if (startChar) {
                    if (!isIdentifierStart(cp)) {
                        return null;
                    }
                } else {
                    if (!isIdentifierPart(cp)) {
                        return null;
                    }
                }

                return codePointString(cp);
            },
            writable: true,
            configurable: true
        },
        readOctalEscape: {
            value: function readOctalEscape() {
                var m = octalEscape.exec(this.input.slice(this.offset, this.offset + 3)),
                    val = m ? m[0] : "";

                this.offset += val.length;

                return val;
            },
            writable: true,
            configurable: true
        },
        readStringEscape: {
            value: function readStringEscape(continuationChar) {
                this.offset++;

                var chr = "",
                    esc = "";

                switch (chr = this.readChar()) {

                    case "t":
                        return "\t";
                    case "b":
                        return "\b";
                    case "v":
                        return "\u000b";
                    case "f":
                        return "\f";
                    case "r":
                        return "\r";
                    case "n":
                        return "\n";

                    case "\r":


                        this.lineMap.addBreak(this.offset - 1);

                        if (this.peekChar() === "\n") this.offset++;

                        return continuationChar;

                    case "\n":
                    case "\u2028":
                    case "\u2029":


                        this.lineMap.addBreak(this.offset - 1);
                        return continuationChar;

                    case "0":
                    case "1":
                    case "2":
                    case "3":
                    case "4":
                    case "5":
                    case "6":
                    case "7":


                        this.offset--;
                        esc = this.readOctalEscape();

                        if (esc === "0") {
                            return String.fromCharCode(0);
                        } else {
                            this.strictError = "Octal literals are not allowed in strict mode";
                            return String.fromCharCode(parseInt(esc, 8));
                        }

                    case "x":


                        esc = this.readHex(2);
                        return esc.length < 2 ? null : String.fromCharCode(parseInt(esc, 16));

                    case "u":


                        return this.readUnicodeEscape();

                    default:


                        return chr;
                }
            },
            writable: true,
            configurable: true
        },
        readRange: {
            value: function readRange(low, high) {
                var start = this.offset,
                    code = 0;

                while (code = this.peekCode()) {
                    if (code >= low && code <= high) this.offset++;else break;
                }

                return this.input.slice(start, this.offset);
            },
            writable: true,
            configurable: true
        },
        readInteger: {
            value: function readInteger() {
                var start = this.offset,
                    code = 0;

                while (code = this.peekCode()) {
                    if (code >= 48 && code <= 57) this.offset++;else break;
                }

                return this.input.slice(start, this.offset);
            },
            writable: true,
            configurable: true
        },
        readHex: {
            value: function readHex(maxLen) {
                var str = "",
                    chr = "";

                while (chr = this.peekChar()) {
                    if (!hexChar.test(chr)) break;

                    str += chr;
                    this.offset++;

                    if (str.length === maxLen) break;
                }

                return str;
            },
            writable: true,
            configurable: true
        },
        peekNumberFollow: {
            value: function peekNumberFollow() {
                var c = this.peekCode();

                if (c > 127) {
                    return !isIdentifierStart(this.peekCodePoint());
                }return !(c > 64 && c < 91 || c > 96 && c < 123 || c > 47 && c < 58 || c === 36 || c === 95 || c === 92);
            },
            writable: true,
            configurable: true
        },
        Skip: {
            value: function Skip() {
                var code = this.peekCode();

                if (code < 128) {
                    switch (charTable[code]) {

                        case "whitespace":
                            return this.Whitespace();

                        case "newline":
                            return this.Newline(code);

                        case "slash":


                            var next = this.peekCodeAt(1);

                            if (next === 47) {
                                return this.LineComment(); // /
                            } else if (next === 42) {
                                return this.BlockComment(); // *
                            }}
                } else {
                    // Unicode newlines
                    if (isNewlineChar(this.peekChar())) {
                        return this.Newline(code);
                    }var cp = this.peekCodePoint();

                    // Unicode whitespace
                    if (isWhitespace(cp)) {
                        return this.UnicodeWhitespace(cp);
                    }
                }

                return "UNKNOWN";
            },
            writable: true,
            configurable: true
        },
        Start: {
            value: function Start(context) {
                var code = this.peekCode(),
                    next = 0;

                switch (charTable[code]) {

                    case "punctuator-char":
                        return this.PunctuatorChar();

                    case "whitespace":
                        return this.Whitespace();

                    case "identifier":
                        return this.Identifier(context, code);

                    case "rbrace":


                        if (context === "template") {
                            return this.Template();
                        } else {
                            return this.PunctuatorChar();
                        }case "punctuator":
                        return this.Punctuator();

                    case "newline":
                        return this.Newline(code);

                    case "decimal-digit":
                        return this.Number();

                    case "template":
                        return this.Template();

                    case "string":
                        return this.String();

                    case "at":
                        return this.AtName();

                    case "zero":


                        switch (next = this.peekCodeAt(1)) {

                            case 88:
                            case 120:
                                return this.HexNumber(); // x
                            case 66:
                            case 98:
                                return this.BinaryNumber(); // b
                            case 79:
                            case 111:
                                return this.OctalNumber(); // o
                        }

                        return next >= 48 && next <= 55 ? this.LegacyOctalNumber() : this.Number();

                    case "dot":


                        next = this.peekCodeAt(1);

                        if (next >= 48 && next <= 57) {
                            return this.Number();
                        } else {
                            return this.Punctuator();
                        }case "slash":


                        next = this.peekCodeAt(1);

                        if (next === 47) {
                            return this.LineComment(); // /
                        } else if (next === 42) {
                            return this.BlockComment(); // *
                        } else if (context === "div") {
                            return this.Punctuator();
                        } else {
                            return this.RegularExpression();
                        }}

                // Unicode newlines
                if (isNewlineChar(this.peekChar())) {
                    return this.Newline(code);
                }var cp = this.peekCodePoint();

                // Unicode whitespace
                if (isWhitespace(cp)) {
                    return this.UnicodeWhitespace(cp);
                } // Unicode identifier chars
                if (isIdentifierStart(cp)) {
                    return this.Identifier(context, cp);
                }return this.Error();
            },
            writable: true,
            configurable: true
        },
        Whitespace: {
            value: function Whitespace() {
                this.offset++;

                var code = 0;

                while (code = this.peekCode()) {
                    // ASCII Whitespace:  [\t] [\v] [\f] [ ]
                    if (code === 9 || code === 11 || code === 12 || code === 32) this.offset++;else break;
                }

                return "";
            },
            writable: true,
            configurable: true
        },
        UnicodeWhitespace: {
            value: function UnicodeWhitespace(cp) {
                this.offset += codePointLength(cp);

                // General unicode whitespace
                while (isWhitespace(cp = this.peekCodePoint())) this.offset += codePointLength(cp);

                return "";
            },
            writable: true,
            configurable: true
        },
        Newline: {
            value: function Newline(code) {
                this.lineMap.addBreak(this.offset++);

                // Treat /r/n as a single newline
                if (code === 13 && this.peekCode() === 10) this.offset++;

                this.newlineBefore = true;

                return "";
            },
            writable: true,
            configurable: true
        },
        PunctuatorChar: {
            value: function PunctuatorChar() {
                return this.readChar();
            },
            writable: true,
            configurable: true
        },
        Punctuator: {
            value: function Punctuator() {
                var op = this.readChar(),
                    chr = "",
                    next = "";

                while (isPunctuatorNext(chr = this.peekChar()) && multiCharPunctuator.test(next = op + chr)) {
                    this.offset++;
                    op = next;
                }

                // ".." is not a valid token
                if (op === "..") {
                    this.offset--;
                    op = ".";
                }

                return op;
            },
            writable: true,
            configurable: true
        },
        Template: {
            value: function Template() {
                var first = this.readChar(),
                    end = false,
                    val = "",
                    esc = "",
                    chr = "";

                while (chr = this.peekChar()) {
                    if (chr === "`") {
                        end = true;
                        break;
                    }

                    if (chr === "$" && this.peekCharAt(1) === "{") {
                        this.offset++;
                        break;
                    }

                    if (chr === "\\") {
                        esc = this.readStringEscape("\n");

                        if (esc === null) {
                            return this.Error();
                        }val += esc;
                    } else {
                        val += chr;
                        this.offset++;
                    }
                }

                if (!chr) {
                    return this.Error();
                }this.offset++;
                this.value = val;
                this.templateEnd = end;

                return "TEMPLATE";
            },
            writable: true,
            configurable: true
        },
        String: {
            value: function String() {
                var delim = this.readChar(),
                    val = "",
                    esc = "",
                    chr = "";

                while (chr = this.input[this.offset]) {
                    if (chr === delim) break;

                    if (isNewlineChar(chr)) {
                        return this.Error();
                    }if (chr === "\\") {
                        esc = this.readStringEscape("");

                        if (esc === null) {
                            return this.Error();
                        }val += esc;
                    } else {
                        val += chr;
                        this.offset++;
                    }
                }

                if (!chr) {
                    return this.Error();
                }this.offset++;
                this.value = val;

                return "STRING";
            },
            writable: true,
            configurable: true
        },
        RegularExpression: {
            value: function RegularExpression() {
                this.offset++;

                var backslash = false,
                    inClass = false,
                    val = "",
                    chr = "",
                    code = 0,
                    flagStart = 0;

                while (chr = this.readChar()) {
                    if (isNewlineChar(chr)) {
                        return this.Error();
                    }if (backslash) {
                        val += "\\" + chr;
                        backslash = false;
                    } else if (chr === "[") {
                        inClass = true;
                        val += chr;
                    } else if (chr === "]" && inClass) {
                        inClass = false;
                        val += chr;
                    } else if (chr === "/" && !inClass) {
                        break;
                    } else if (chr === "\\") {
                        backslash = true;
                    } else {
                        val += chr;
                    }
                }

                if (!chr) {
                    return this.Error();
                }flagStart = this.offset;

                while (true) {
                    code = this.peekCode();

                    if (code === 92) {
                        return this.Error();
                    } else if (code > 127) {
                        if (isIdentifierPart(code = this.peekCodePoint())) this.offset += codePointLength(code);else break;
                    } else if (isIdentifierPartAscii(code)) {
                        this.offset++;
                    } else {
                        break;
                    }
                }

                this.value = val;
                this.regexFlags = this.input.slice(flagStart, this.offset);

                return "REGEX";
            },
            writable: true,
            configurable: true
        },
        LegacyOctalNumber: {
            value: function LegacyOctalNumber() {
                this.offset++;

                var start = this.offset,
                    code = 0;

                while (code = this.peekCode()) {
                    if (code >= 48 && code <= 55) this.offset++;else break;
                }

                this.strictError = "Octal literals are not allowed in strict mode";

                var val = parseInt(this.input.slice(start, this.offset), 8);

                if (!this.peekNumberFollow()) {
                    return this.Error();
                }this.number = val;

                return "NUMBER";
            },
            writable: true,
            configurable: true
        },
        Number: {
            value: function Number() {
                var start = this.offset,
                    next = "";

                this.readInteger();

                if ((next = this.peekChar()) === ".") {
                    this.offset++;
                    this.readInteger();
                    next = this.peekChar();
                }

                if (next === "e" || next === "E") {
                    this.offset++;

                    next = this.peekChar();

                    if (next === "+" || next === "-") this.offset++;

                    if (!this.readInteger()) {
                        return this.Error();
                    }
                }

                var val = parseFloat(this.input.slice(start, this.offset));

                if (!this.peekNumberFollow()) {
                    return this.Error();
                }this.number = val;

                return "NUMBER";
            },
            writable: true,
            configurable: true
        },
        BinaryNumber: {
            value: function BinaryNumber() {
                this.offset += 2;

                var val = parseInt(this.readRange(48, 49), 2);

                if (!this.peekNumberFollow()) {
                    return this.Error();
                }this.number = val;

                return "NUMBER";
            },
            writable: true,
            configurable: true
        },
        OctalNumber: {
            value: function OctalNumber() {
                this.offset += 2;

                var val = parseInt(this.readRange(48, 55), 8);

                if (!this.peekNumberFollow()) {
                    return this.Error();
                }this.number = val;

                return "NUMBER";
            },
            writable: true,
            configurable: true
        },
        HexNumber: {
            value: function HexNumber() {
                this.offset += 2;

                var val = parseInt(this.readHex(0), 16);

                if (!this.peekNumberFollow()) {
                    return this.Error();
                }this.number = val;

                return "NUMBER";
            },
            writable: true,
            configurable: true
        },
        Identifier: {
            value: function Identifier(context, code) {
                var start = this.offset,
                    val = "",
                    esc = "";

                // Identifier Start

                if (code === 92) {
                    esc = this.readIdentifierEscape(true);

                    if (esc === null) {
                        return this.Error();
                    }val = esc;
                    start = this.offset;
                } else if (code > 127) {
                    this.offset += codePointLength(code);
                } else {
                    this.offset++;
                }

                // Identifier Part

                while (true) {
                    code = this.peekCode();

                    if (code === 92) {
                        val += this.input.slice(start, this.offset);
                        esc = this.readIdentifierEscape(false);

                        if (esc === null) {
                            return this.Error();
                        }val += esc;
                        start = this.offset;
                    } else if (code > 127) {
                        if (isIdentifierPart(code = this.peekCodePoint())) this.offset += codePointLength(code);else break;
                    } else if (isIdentifierPartAscii(code)) {
                        this.offset++;
                    } else {
                        break;
                    }
                }

                val += this.input.slice(start, this.offset);

                this.value = val;

                if (context !== "name" && isReservedWord(val)) {
                    return esc ? this.Error() : val;
                }return "IDENTIFIER";
            },
            writable: true,
            configurable: true
        },
        AtName: {
            value: function AtName() {
                this.offset += 1;

                if (this.Start("name") !== "IDENTIFIER") {
                    return this.Error();
                } // TODO: This is a bit of a hack
                this.value = "@" + this.value;

                return "ATNAME";
            },
            writable: true,
            configurable: true
        },
        LineComment: {
            value: function LineComment() {
                this.offset += 2;

                var start = this.offset,
                    chr = "";

                while (chr = this.peekChar()) {
                    if (isNewlineChar(chr)) break;

                    this.offset++;
                }

                this.value = this.input.slice(start, this.offset);

                return "COMMENT";
            },
            writable: true,
            configurable: true
        },
        BlockComment: {
            value: function BlockComment() {
                this.offset += 2;

                var pattern = blockCommentPattern,
                    start = this.offset;

                while (true) {
                    pattern.lastIndex = this.offset;

                    var m = pattern.exec(this.input);
                    if (!m) {
                        return this.Error();
                    }this.offset = m.index + m[0].length;

                    if (m[0] === "*/") break;

                    this.newlineBefore = true;
                    this.lineMap.addBreak(m.index);
                }

                this.value = this.input.slice(start, this.offset - 2);

                return "COMMENT";
            },
            writable: true,
            configurable: true
        },
        EOF: {
            value: function EOF() {
                return "EOF";
            },
            writable: true,
            configurable: true
        },
        Error: {
            value: function Error(msg) {
                if (this.start === this.offset) this.offset++;

                return "ILLEGAL";
            },
            writable: true,
            configurable: true
        }
    });

    return Scanner;
})();
//# sourceMappingURL=data:application/json;base64,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TSxDQUFDOztBQUVoQyx3QkFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDakMsd0JBQUksQ0FBQyxDQUFDO0FBQUUsK0JBQU8sSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO3FCQUFBLEFBRTVCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDOztBQUVwQyx3QkFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUNiLE1BQU07O0FBRVYsd0JBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzFCLHdCQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ2xDOztBQUVELG9CQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDOztBQUV0RCx1QkFBTyxTQUFTLENBQUM7YUFDcEI7Ozs7QUFFRCxXQUFHO21CQUFBLGVBQUc7QUFFRix1QkFBTyxLQUFLLENBQUM7YUFDaEI7Ozs7QUFFRCxhQUFLO21CQUFBLGVBQUMsR0FBRyxFQUFFO0FBRVAsb0JBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsTUFBTSxFQUMxQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7O0FBRWxCLHVCQUFPLFNBQVMsQ0FBQzthQUNwQjs7Ozs7O1dBcjNCUSxPQUFPIiwiZmlsZSI6InNyYy9TY2FubmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcblxuICAgIGlzSWRlbnRpZmllclN0YXJ0LFxuICAgIGlzSWRlbnRpZmllclBhcnQsXG4gICAgaXNXaGl0ZXNwYWNlLFxuICAgIGNvZGVQb2ludExlbmd0aCxcbiAgICBjb2RlUG9pbnRBdCxcbiAgICBjb2RlUG9pbnRTdHJpbmdcblxufSBmcm9tIFwiLi9Vbmljb2RlLmpzXCI7XG5cbmltcG9ydCB7IExpbmVNYXAgfSBmcm9tIFwiLi9MaW5lTWFwLmpzXCI7XG5cbmNvbnN0IGlkZW50aWZpZXJFc2NhcGUgPSAvXFxcXHUoWzAtOWEtZkEtRl17NH0pL2csXG4gICAgICBuZXdsaW5lU2VxdWVuY2UgPSAvXFxyXFxuP3xbXFxuXFx1MjAyOFxcdTIwMjldL2csXG4gICAgICBjck5ld2xpbmUgPSAvXFxyXFxuPy9nO1xuXG4vLyA9PT0gUmVzZXJ2ZWQgV29yZHMgPT09XG5jb25zdCByZXNlcnZlZFdvcmQgPSBuZXcgUmVnRXhwKFwiXig/OlwiICtcbiAgICBcImJyZWFrfGNhc2V8Y2F0Y2h8Y2xhc3N8Y29uc3R8Y29udGludWV8ZGVidWdnZXJ8ZGVmYXVsdHxkZWxldGV8ZG98XCIgK1xuICAgIFwiZWxzZXxlbnVtfGV4cG9ydHxleHRlbmRzfGZhbHNlfGZpbmFsbHl8Zm9yfGZ1bmN0aW9ufGlmfGltcG9ydHxpbnxcIiArXG4gICAgXCJpbnN0YW5jZW9mfG5ld3xudWxsfHJldHVybnxzdXBlcnxzd2l0Y2h8dGhpc3x0aHJvd3x0cnVlfHRyeXx0eXBlb2Z8XCIgK1xuICAgIFwidmFyfHZvaWR8d2hpbGV8d2l0aFwiICtcblwiKSRcIik7XG5cbmNvbnN0IHN0cmljdFJlc2VydmVkV29yZCA9IG5ldyBSZWdFeHAoXCJeKD86XCIgK1xuICAgIFwiaW1wbGVtZW50c3xwcml2YXRlfHB1YmxpY3xpbnRlcmZhY2V8cGFja2FnZXxsZXR8cHJvdGVjdGVkfHN0YXRpY3x5aWVsZFwiICtcblwiKSRcIik7XG5cbi8vID09PSBQdW5jdHVhdG9ycyA9PT1cbmNvbnN0IG11bHRpQ2hhclB1bmN0dWF0b3IgPSBuZXcgUmVnRXhwKFwiXig/OlwiICtcbiAgICBcIi0tfFsrXXsyfXxcIiArXG4gICAgXCImJnxbfF17Mn18XCIgK1xuICAgIFwiPDw9P3xcIiArXG4gICAgXCI+Pj4/PT98XCIgK1xuICAgIFwiWyE9XT09fFwiICtcbiAgICBcIj0+fFwiICtcbiAgICBcIltcXC5dezIsM318XCIgK1xuICAgIFwiOjp8XCIgK1xuICAgIFwiWy0rJnw8PiE9KiZcXF4lXFwvXT1cIiArXG5cIikkXCIpO1xuXG4vLyA9PT0gTWlzY2VsbGFuZW91cyBQYXR0ZXJucyA9PT1cbmNvbnN0IG9jdGFsRXNjYXBlID0gL14oPzpbMC0zXVswLTddezAsMn18WzQtN11bMC03XT8pLyxcbiAgICAgIGJsb2NrQ29tbWVudFBhdHRlcm4gPSAvXFxyXFxuP3xbXFxuXFx1MjAyOFxcdTIwMjldfFxcKlxcLy9nLFxuICAgICAgaGV4Q2hhciA9IC9bMC05YS1mXS9pO1xuXG4vLyA9PT0gQ2hhcmFjdGVyIHR5cGUgbG9va3VwIHRhYmxlID09PVxuZnVuY3Rpb24gbWFrZUNoYXJUYWJsZSgpIHtcblxuICAgIGxldCB0YWJsZSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMjg7ICsraSkgdGFibGVbaV0gPSBcIlwiO1xuICAgIGZvciAobGV0IGkgPSA2NTsgaSA8PSA5MDsgKytpKSB0YWJsZVtpXSA9IFwiaWRlbnRpZmllclwiO1xuICAgIGZvciAobGV0IGkgPSA5NzsgaSA8PSAxMjI7ICsraSkgdGFibGVbaV0gPSBcImlkZW50aWZpZXJcIjtcblxuICAgIGFkZChcIndoaXRlc3BhY2VcIiwgXCJcXHRcXHZcXGYgXCIpO1xuICAgIGFkZChcIm5ld2xpbmVcIiwgXCJcXHJcXG5cIik7XG4gICAgYWRkKFwiZGVjaW1hbC1kaWdpdFwiLCBcIjEyMzQ1Njc4OVwiKTtcbiAgICBhZGQoXCJwdW5jdHVhdG9yLWNoYXJcIiwgXCJ7W10oKTssP1wiKTtcbiAgICBhZGQoXCJwdW5jdHVhdG9yXCIsIFwiPD4rLSolJnxeIX49OlwiKTtcbiAgICBhZGQoXCJkb3RcIiwgXCIuXCIpO1xuICAgIGFkZChcInNsYXNoXCIsIFwiL1wiKTtcbiAgICBhZGQoXCJyYnJhY2VcIiwgXCJ9XCIpO1xuICAgIGFkZChcInplcm9cIiwgXCIwXCIpO1xuICAgIGFkZChcInN0cmluZ1wiLCBcIidcXFwiXCIpO1xuICAgIGFkZChcInRlbXBsYXRlXCIsIFwiYFwiKTtcbiAgICBhZGQoXCJpZGVudGlmaWVyXCIsIFwiJF9cXFxcXCIpO1xuICAgIGFkZChcImF0XCIsIFwiQFwiKTtcblxuICAgIHJldHVybiB0YWJsZTtcblxuICAgIGZ1bmN0aW9uIGFkZCh0eXBlLCBzdHJpbmcpIHtcblxuICAgICAgICBzdHJpbmcuc3BsaXQoXCJcIikuZm9yRWFjaChjID0+IHRhYmxlW2MuY2hhckNvZGVBdCgwKV0gPSB0eXBlKTtcbiAgICB9XG59XG5cbmNvbnN0IGNoYXJUYWJsZSA9IG1ha2VDaGFyVGFibGUoKTtcblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBjaGFyYWN0ZXIgaXMgYSB2YWxpZCBpZGVudGlmaWVyIHBhcnRcbmZ1bmN0aW9uIGlzSWRlbnRpZmllclBhcnRBc2NpaShjKSB7XG5cbiAgICByZXR1cm4gIGMgPiA2NCAmJiBjIDwgOTEgfHxcbiAgICAgICAgICAgIGMgPiA5NiAmJiBjIDwgMTIzIHx8XG4gICAgICAgICAgICBjID4gNDcgJiYgYyA8IDU4IHx8XG4gICAgICAgICAgICBjID09PSAzNiB8fFxuICAgICAgICAgICAgYyA9PT0gOTU7XG59XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIGNoYXJhY3RlciBpcyBhIG5ld2xpbmVcbmZ1bmN0aW9uIGlzTmV3bGluZUNoYXIoYykge1xuXG4gICAgc3dpdGNoIChjKSB7XG5cbiAgICAgICAgY2FzZSBcIlxcclwiOlxuICAgICAgICBjYXNlIFwiXFxuXCI6XG4gICAgICAgIGNhc2UgXCJcXHUyMDI4XCI6XG4gICAgICAgIGNhc2UgXCJcXHUyMDI5XCI6XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIGNoYXJhY3RlciBjYW4gZXhpc3QgaW4gYSBub24tc3RhcnRpbmcgcG9zaXRpb25cbmZ1bmN0aW9uIGlzUHVuY3R1YXRvck5leHQoYykge1xuXG4gICAgc3dpdGNoIChjKSB7XG5cbiAgICAgICAgY2FzZSBcIitcIjpcbiAgICAgICAgY2FzZSBcIi1cIjpcbiAgICAgICAgY2FzZSBcIiZcIjpcbiAgICAgICAgY2FzZSBcInxcIjpcbiAgICAgICAgY2FzZSBcIjxcIjpcbiAgICAgICAgY2FzZSBcIj5cIjpcbiAgICAgICAgY2FzZSBcIj1cIjpcbiAgICAgICAgY2FzZSBcIi5cIjpcbiAgICAgICAgY2FzZSBcIjpcIjpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgc3RyaW5nIGlzIGEgcmVzZXJ2ZWQgd29yZFxuZXhwb3J0IGZ1bmN0aW9uIGlzUmVzZXJ2ZWRXb3JkKHdvcmQpIHtcblxuICAgIHJldHVybiByZXNlcnZlZFdvcmQudGVzdCh3b3JkKTtcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgc3RyaW5nIGlzIGEgc3RyaWN0IG1vZGUgcmVzZXJ2ZWQgd29yZFxuZXhwb3J0IGZ1bmN0aW9uIGlzU3RyaWN0UmVzZXJ2ZWRXb3JkKHdvcmQpIHtcblxuICAgIHJldHVybiBzdHJpY3RSZXNlcnZlZFdvcmQudGVzdCh3b3JkKTtcbn1cblxuZXhwb3J0IGNsYXNzIFNjYW5uZXIge1xuXG4gICAgY29uc3RydWN0b3IoaW5wdXQpIHtcblxuICAgICAgICB0aGlzLmlucHV0ID0gaW5wdXQgfHwgXCJcIjtcbiAgICAgICAgdGhpcy5vZmZzZXQgPSAwO1xuICAgICAgICB0aGlzLmxlbmd0aCA9IHRoaXMuaW5wdXQubGVuZ3RoO1xuICAgICAgICB0aGlzLmxpbmVNYXAgPSBuZXcgTGluZU1hcDtcblxuICAgICAgICB0aGlzLnZhbHVlID0gXCJcIjtcbiAgICAgICAgdGhpcy5udW1iZXIgPSAwO1xuICAgICAgICB0aGlzLnJlZ2V4RmxhZ3MgPSBcIlwiO1xuICAgICAgICB0aGlzLnRlbXBsYXRlRW5kID0gZmFsc2U7XG4gICAgICAgIHRoaXMubmV3bGluZUJlZm9yZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnN0cmljdEVycm9yID0gXCJcIjtcbiAgICAgICAgdGhpcy5zdGFydCA9IDA7XG4gICAgICAgIHRoaXMuZW5kID0gMDtcbiAgICB9XG5cbiAgICBza2lwKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLm5leHQoXCJza2lwXCIpO1xuICAgIH1cblxuICAgIG5leHQoY29udGV4dCkge1xuXG4gICAgICAgIGlmICh0aGlzLnR5cGUgIT09IFwiQ09NTUVOVFwiKVxuICAgICAgICAgICAgdGhpcy5uZXdsaW5lQmVmb3JlID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5zdHJpY3RFcnJvciA9IFwiXCI7XG5cbiAgICAgICAgZG8ge1xuXG4gICAgICAgICAgICB0aGlzLnN0YXJ0ID0gdGhpcy5vZmZzZXQ7XG5cbiAgICAgICAgICAgIHRoaXMudHlwZSA9XG4gICAgICAgICAgICAgICAgdGhpcy5zdGFydCA+PSB0aGlzLmxlbmd0aCA/IHRoaXMuRU9GKCkgOlxuICAgICAgICAgICAgICAgIGNvbnRleHQgPT09IFwic2tpcFwiID8gdGhpcy5Ta2lwKCkgOlxuICAgICAgICAgICAgICAgIHRoaXMuU3RhcnQoY29udGV4dCk7XG5cbiAgICAgICAgfSB3aGlsZSAoIXRoaXMudHlwZSlcblxuICAgICAgICB0aGlzLmVuZCA9IHRoaXMub2Zmc2V0O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnR5cGU7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogIFNob3VsZCB0aGlzIGJlIHB1dCBvbiBQYXJzZVJlc3VsdCBpbnN0ZWFkP1xuICAgIHJhd1ZhbHVlKHN0YXJ0LCBlbmQpIHtcblxuICAgICAgICAvLyBMaW5lIGVuZGluZ3MgYXJlIG5vcm1hbGl6ZWQgdG8gPExGPlxuICAgICAgICByZXR1cm4gdGhpcy5pbnB1dC5zbGljZShzdGFydCwgZW5kKS5yZXBsYWNlKGNyTmV3bGluZSwgXCJcXG5cIik7XG4gICAgfVxuXG4gICAgcGVla0NoYXIoKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5wdXQuY2hhckF0KHRoaXMub2Zmc2V0KTtcbiAgICB9XG5cbiAgICBwZWVrQ2hhckF0KG4pIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5pbnB1dC5jaGFyQXQodGhpcy5vZmZzZXQgKyBuKTtcbiAgICB9XG5cbiAgICBwZWVrQ29kZVBvaW50KCkge1xuXG4gICAgICAgIHJldHVybiBjb2RlUG9pbnRBdCh0aGlzLmlucHV0LCB0aGlzLm9mZnNldCk7XG4gICAgfVxuXG4gICAgcGVla0NvZGUoKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLm9mZnNldCkgfCAwO1xuICAgIH1cblxuICAgIHBlZWtDb2RlQXQobikge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5vZmZzZXQgKyBuKSB8IDA7XG4gICAgfVxuXG4gICAgcmVhZENoYXIoKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5wdXQuY2hhckF0KHRoaXMub2Zmc2V0KyspO1xuICAgIH1cblxuICAgIHJlYWRVbmljb2RlRXNjYXBlVmFsdWUoKSB7XG5cbiAgICAgICAgbGV0IGhleCA9IFwiXCI7XG5cbiAgICAgICAgaWYgKHRoaXMucGVla0NoYXIoKSA9PT0gXCJ7XCIpIHtcblxuICAgICAgICAgICAgdGhpcy5vZmZzZXQrKztcbiAgICAgICAgICAgIGhleCA9IHRoaXMucmVhZEhleCgwKTtcblxuICAgICAgICAgICAgaWYgKGhleC5sZW5ndGggPCAxIHx8IHRoaXMucmVhZENoYXIoKSAhPT0gXCJ9XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgaGV4ID0gdGhpcy5yZWFkSGV4KDQpO1xuXG4gICAgICAgICAgICBpZiAoaGV4Lmxlbmd0aCA8IDQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcGFyc2VJbnQoaGV4LCAxNik7XG4gICAgfVxuXG4gICAgcmVhZFVuaWNvZGVFc2NhcGUoKSB7XG5cbiAgICAgICAgbGV0IGNwID0gdGhpcy5yZWFkVW5pY29kZUVzY2FwZVZhbHVlKCksXG4gICAgICAgICAgICB2YWwgPSBjb2RlUG9pbnRTdHJpbmcoY3ApO1xuXG4gICAgICAgIHJldHVybiB2YWwgPT09IFwiXCIgPyBudWxsIDogdmFsO1xuICAgIH1cblxuICAgIHJlYWRJZGVudGlmaWVyRXNjYXBlKHN0YXJ0Q2hhcikge1xuXG4gICAgICAgIHRoaXMub2Zmc2V0Kys7XG5cbiAgICAgICAgaWYgKHRoaXMucmVhZENoYXIoKSAhPT0gXCJ1XCIpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICBsZXQgY3AgPSB0aGlzLnJlYWRVbmljb2RlRXNjYXBlVmFsdWUoKTtcblxuICAgICAgICBpZiAoc3RhcnRDaGFyKSB7XG5cbiAgICAgICAgICAgIGlmICghaXNJZGVudGlmaWVyU3RhcnQoY3ApKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIGlmICghaXNJZGVudGlmaWVyUGFydChjcCkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29kZVBvaW50U3RyaW5nKGNwKTtcbiAgICB9XG5cbiAgICByZWFkT2N0YWxFc2NhcGUoKSB7XG5cbiAgICAgICAgbGV0IG0gPSBvY3RhbEVzY2FwZS5leGVjKHRoaXMuaW5wdXQuc2xpY2UodGhpcy5vZmZzZXQsIHRoaXMub2Zmc2V0ICsgMykpLFxuICAgICAgICAgICAgdmFsID0gbSA/IG1bMF0gOiBcIlwiO1xuXG4gICAgICAgIHRoaXMub2Zmc2V0ICs9IHZhbC5sZW5ndGg7XG5cbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG5cbiAgICByZWFkU3RyaW5nRXNjYXBlKGNvbnRpbnVhdGlvbkNoYXIpIHtcblxuICAgICAgICB0aGlzLm9mZnNldCsrO1xuXG4gICAgICAgIGxldCBjaHIgPSBcIlwiLFxuICAgICAgICAgICAgZXNjID0gXCJcIjtcblxuICAgICAgICBzd2l0Y2ggKGNociA9IHRoaXMucmVhZENoYXIoKSkge1xuXG4gICAgICAgICAgICBjYXNlIFwidFwiOiByZXR1cm4gXCJcXHRcIjtcbiAgICAgICAgICAgIGNhc2UgXCJiXCI6IHJldHVybiBcIlxcYlwiO1xuICAgICAgICAgICAgY2FzZSBcInZcIjogcmV0dXJuIFwiXFx2XCI7XG4gICAgICAgICAgICBjYXNlIFwiZlwiOiByZXR1cm4gXCJcXGZcIjtcbiAgICAgICAgICAgIGNhc2UgXCJyXCI6IHJldHVybiBcIlxcclwiO1xuICAgICAgICAgICAgY2FzZSBcIm5cIjogcmV0dXJuIFwiXFxuXCI7XG5cbiAgICAgICAgICAgIGNhc2UgXCJcXHJcIjpcblxuICAgICAgICAgICAgICAgIHRoaXMubGluZU1hcC5hZGRCcmVhayh0aGlzLm9mZnNldCAtIDEpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGVla0NoYXIoKSA9PT0gXCJcXG5cIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vZmZzZXQrKztcblxuICAgICAgICAgICAgICAgIHJldHVybiBjb250aW51YXRpb25DaGFyO1xuXG4gICAgICAgICAgICBjYXNlIFwiXFxuXCI6XG4gICAgICAgICAgICBjYXNlIFwiXFx1MjAyOFwiOlxuICAgICAgICAgICAgY2FzZSBcIlxcdTIwMjlcIjpcblxuICAgICAgICAgICAgICAgIHRoaXMubGluZU1hcC5hZGRCcmVhayh0aGlzLm9mZnNldCAtIDEpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjb250aW51YXRpb25DaGFyO1xuXG4gICAgICAgICAgICBjYXNlIFwiMFwiOlxuICAgICAgICAgICAgY2FzZSBcIjFcIjpcbiAgICAgICAgICAgIGNhc2UgXCIyXCI6XG4gICAgICAgICAgICBjYXNlIFwiM1wiOlxuICAgICAgICAgICAgY2FzZSBcIjRcIjpcbiAgICAgICAgICAgIGNhc2UgXCI1XCI6XG4gICAgICAgICAgICBjYXNlIFwiNlwiOlxuICAgICAgICAgICAgY2FzZSBcIjdcIjpcblxuICAgICAgICAgICAgICAgIHRoaXMub2Zmc2V0LS07XG4gICAgICAgICAgICAgICAgZXNjID0gdGhpcy5yZWFkT2N0YWxFc2NhcGUoKTtcblxuICAgICAgICAgICAgICAgIGlmIChlc2MgPT09IFwiMFwiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMCk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyaWN0RXJyb3IgPSBcIk9jdGFsIGxpdGVyYWxzIGFyZSBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZVwiO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChlc2MsIDgpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2UgXCJ4XCI6XG5cbiAgICAgICAgICAgICAgICBlc2MgPSB0aGlzLnJlYWRIZXgoMik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChlc2MubGVuZ3RoIDwgMikgPyBudWxsIDogU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChlc2MsIDE2KSk7XG5cbiAgICAgICAgICAgIGNhc2UgXCJ1XCI6XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkVW5pY29kZUVzY2FwZSgpO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNocjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlYWRSYW5nZShsb3csIGhpZ2gpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm9mZnNldCxcbiAgICAgICAgICAgIGNvZGUgPSAwO1xuXG4gICAgICAgIHdoaWxlIChjb2RlID0gdGhpcy5wZWVrQ29kZSgpKSB7XG5cbiAgICAgICAgICAgIGlmIChjb2RlID49IGxvdyAmJiBjb2RlIDw9IGhpZ2gpIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgICAgICBlbHNlIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQsIHRoaXMub2Zmc2V0KTtcbiAgICB9XG5cbiAgICByZWFkSW50ZWdlcigpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm9mZnNldCxcbiAgICAgICAgICAgIGNvZGUgPSAwO1xuXG4gICAgICAgIHdoaWxlIChjb2RlID0gdGhpcy5wZWVrQ29kZSgpKSB7XG5cbiAgICAgICAgICAgIGlmIChjb2RlID49IDQ4ICYmIGNvZGUgPD0gNTcpIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgICAgICBlbHNlIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQsIHRoaXMub2Zmc2V0KTtcbiAgICB9XG5cbiAgICByZWFkSGV4KG1heExlbikge1xuXG4gICAgICAgIGxldCBzdHIgPSBcIlwiLFxuICAgICAgICAgICAgY2hyID0gXCJcIjtcblxuICAgICAgICB3aGlsZSAoY2hyID0gdGhpcy5wZWVrQ2hhcigpKSB7XG5cbiAgICAgICAgICAgIGlmICghaGV4Q2hhci50ZXN0KGNocikpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHN0ciArPSBjaHI7XG4gICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuXG4gICAgICAgICAgICBpZiAoc3RyLmxlbmd0aCA9PT0gbWF4TGVuKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICBwZWVrTnVtYmVyRm9sbG93KCkge1xuXG4gICAgICAgIGxldCBjID0gdGhpcy5wZWVrQ29kZSgpO1xuXG4gICAgICAgIGlmIChjID4gMTI3KVxuICAgICAgICAgICAgcmV0dXJuICFpc0lkZW50aWZpZXJTdGFydCh0aGlzLnBlZWtDb2RlUG9pbnQoKSk7XG5cbiAgICAgICAgcmV0dXJuICEoXG4gICAgICAgICAgICBjID4gNjQgJiYgYyA8IDkxIHx8XG4gICAgICAgICAgICBjID4gOTYgJiYgYyA8IDEyMyB8fFxuICAgICAgICAgICAgYyA+IDQ3ICYmIGMgPCA1OCB8fFxuICAgICAgICAgICAgYyA9PT0gMzYgfHxcbiAgICAgICAgICAgIGMgPT09IDk1IHx8XG4gICAgICAgICAgICBjID09PSA5MlxuICAgICAgICApO1xuICAgIH1cblxuICAgIFNraXAoKSB7XG5cbiAgICAgICAgbGV0IGNvZGUgPSB0aGlzLnBlZWtDb2RlKCk7XG5cbiAgICAgICAgaWYgKGNvZGUgPCAxMjgpIHtcblxuICAgICAgICAgICAgc3dpdGNoIChjaGFyVGFibGVbY29kZV0pIHtcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJ3aGl0ZXNwYWNlXCI6IHJldHVybiB0aGlzLldoaXRlc3BhY2UoKTtcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJuZXdsaW5lXCI6IHJldHVybiB0aGlzLk5ld2xpbmUoY29kZSk7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwic2xhc2hcIjpcblxuICAgICAgICAgICAgICAgICAgICBsZXQgbmV4dCA9IHRoaXMucGVla0NvZGVBdCgxKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobmV4dCA9PT0gNDcpIHJldHVybiB0aGlzLkxpbmVDb21tZW50KCk7ICAgICAgIC8vIC9cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAobmV4dCA9PT0gNDIpIHJldHVybiB0aGlzLkJsb2NrQ29tbWVudCgpOyAvLyAqXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gVW5pY29kZSBuZXdsaW5lc1xuICAgICAgICAgICAgaWYgKGlzTmV3bGluZUNoYXIodGhpcy5wZWVrQ2hhcigpKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5OZXdsaW5lKGNvZGUpO1xuXG4gICAgICAgICAgICBsZXQgY3AgPSB0aGlzLnBlZWtDb2RlUG9pbnQoKTtcblxuICAgICAgICAgICAgLy8gVW5pY29kZSB3aGl0ZXNwYWNlXG4gICAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGNwKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5Vbmljb2RlV2hpdGVzcGFjZShjcCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gXCJVTktOT1dOXCI7XG4gICAgfVxuXG4gICAgU3RhcnQoY29udGV4dCkge1xuXG4gICAgICAgIGxldCBjb2RlID0gdGhpcy5wZWVrQ29kZSgpLFxuICAgICAgICAgICAgbmV4dCA9IDA7XG5cbiAgICAgICAgc3dpdGNoIChjaGFyVGFibGVbY29kZV0pIHtcblxuICAgICAgICAgICAgY2FzZSBcInB1bmN0dWF0b3ItY2hhclwiOiByZXR1cm4gdGhpcy5QdW5jdHVhdG9yQ2hhcigpO1xuXG4gICAgICAgICAgICBjYXNlIFwid2hpdGVzcGFjZVwiOiByZXR1cm4gdGhpcy5XaGl0ZXNwYWNlKCk7XG5cbiAgICAgICAgICAgIGNhc2UgXCJpZGVudGlmaWVyXCI6IHJldHVybiB0aGlzLklkZW50aWZpZXIoY29udGV4dCwgY29kZSk7XG5cbiAgICAgICAgICAgIGNhc2UgXCJyYnJhY2VcIjpcblxuICAgICAgICAgICAgICAgIGlmIChjb250ZXh0ID09PSBcInRlbXBsYXRlXCIpIHJldHVybiB0aGlzLlRlbXBsYXRlKCk7XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4gdGhpcy5QdW5jdHVhdG9yQ2hhcigpO1xuXG4gICAgICAgICAgICBjYXNlIFwicHVuY3R1YXRvclwiOiByZXR1cm4gdGhpcy5QdW5jdHVhdG9yKCk7XG5cbiAgICAgICAgICAgIGNhc2UgXCJuZXdsaW5lXCI6IHJldHVybiB0aGlzLk5ld2xpbmUoY29kZSk7XG5cbiAgICAgICAgICAgIGNhc2UgXCJkZWNpbWFsLWRpZ2l0XCI6IHJldHVybiB0aGlzLk51bWJlcigpO1xuXG4gICAgICAgICAgICBjYXNlIFwidGVtcGxhdGVcIjogcmV0dXJuIHRoaXMuVGVtcGxhdGUoKTtcblxuICAgICAgICAgICAgY2FzZSBcInN0cmluZ1wiOiByZXR1cm4gdGhpcy5TdHJpbmcoKTtcblxuICAgICAgICAgICAgY2FzZSBcImF0XCI6IHJldHVybiB0aGlzLkF0TmFtZSgpO1xuXG4gICAgICAgICAgICBjYXNlIFwiemVyb1wiOlxuXG4gICAgICAgICAgICAgICAgc3dpdGNoIChuZXh0ID0gdGhpcy5wZWVrQ29kZUF0KDEpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSA4ODogY2FzZSAxMjA6IHJldHVybiB0aGlzLkhleE51bWJlcigpOyAgIC8vIHhcbiAgICAgICAgICAgICAgICAgICAgY2FzZSA2NjogY2FzZSA5ODogcmV0dXJuIHRoaXMuQmluYXJ5TnVtYmVyKCk7IC8vIGJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSA3OTogY2FzZSAxMTE6IHJldHVybiB0aGlzLk9jdGFsTnVtYmVyKCk7IC8vIG9cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbmV4dCA+PSA0OCAmJiBuZXh0IDw9IDU1ID9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5MZWdhY3lPY3RhbE51bWJlcigpIDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5OdW1iZXIoKTtcblxuICAgICAgICAgICAgY2FzZSBcImRvdFwiOlxuXG4gICAgICAgICAgICAgICAgbmV4dCA9IHRoaXMucGVla0NvZGVBdCgxKTtcblxuICAgICAgICAgICAgICAgIGlmIChuZXh0ID49IDQ4ICYmIG5leHQgPD0gNTcpIHJldHVybiB0aGlzLk51bWJlcigpO1xuICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHRoaXMuUHVuY3R1YXRvcigpO1xuXG4gICAgICAgICAgICBjYXNlIFwic2xhc2hcIjpcblxuICAgICAgICAgICAgICAgIG5leHQgPSB0aGlzLnBlZWtDb2RlQXQoMSk7XG5cbiAgICAgICAgICAgICAgICBpZiAobmV4dCA9PT0gNDcpIHJldHVybiB0aGlzLkxpbmVDb21tZW50KCk7ICAgICAgIC8vIC9cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChuZXh0ID09PSA0MikgcmV0dXJuIHRoaXMuQmxvY2tDb21tZW50KCk7IC8vICpcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChjb250ZXh0ID09PSBcImRpdlwiKSByZXR1cm4gdGhpcy5QdW5jdHVhdG9yKCk7XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4gdGhpcy5SZWd1bGFyRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvLyBVbmljb2RlIG5ld2xpbmVzXG4gICAgICAgIGlmIChpc05ld2xpbmVDaGFyKHRoaXMucGVla0NoYXIoKSkpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5OZXdsaW5lKGNvZGUpO1xuXG4gICAgICAgIGxldCBjcCA9IHRoaXMucGVla0NvZGVQb2ludCgpO1xuXG4gICAgICAgIC8vIFVuaWNvZGUgd2hpdGVzcGFjZVxuICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGNwKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLlVuaWNvZGVXaGl0ZXNwYWNlKGNwKTtcblxuICAgICAgICAvLyBVbmljb2RlIGlkZW50aWZpZXIgY2hhcnNcbiAgICAgICAgaWYgKGlzSWRlbnRpZmllclN0YXJ0KGNwKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLklkZW50aWZpZXIoY29udGV4dCwgY3ApO1xuXG4gICAgICAgIHJldHVybiB0aGlzLkVycm9yKCk7XG4gICAgfVxuXG4gICAgV2hpdGVzcGFjZSgpIHtcblxuICAgICAgICB0aGlzLm9mZnNldCsrO1xuXG4gICAgICAgIGxldCBjb2RlID0gMDtcblxuICAgICAgICB3aGlsZSAoY29kZSA9IHRoaXMucGVla0NvZGUoKSkge1xuXG4gICAgICAgICAgICAvLyBBU0NJSSBXaGl0ZXNwYWNlOiAgW1xcdF0gW1xcdl0gW1xcZl0gWyBdXG4gICAgICAgICAgICBpZiAoY29kZSA9PT0gOSB8fCBjb2RlID09PSAxMSB8fCBjb2RlID09PSAxMiB8fCBjb2RlID09PSAzMilcbiAgICAgICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfVxuXG4gICAgVW5pY29kZVdoaXRlc3BhY2UoY3ApIHtcblxuICAgICAgICB0aGlzLm9mZnNldCArPSBjb2RlUG9pbnRMZW5ndGgoY3ApO1xuXG4gICAgICAgIC8vIEdlbmVyYWwgdW5pY29kZSB3aGl0ZXNwYWNlXG4gICAgICAgIHdoaWxlIChpc1doaXRlc3BhY2UoY3AgPSB0aGlzLnBlZWtDb2RlUG9pbnQoKSkpXG4gICAgICAgICAgICB0aGlzLm9mZnNldCArPSBjb2RlUG9pbnRMZW5ndGgoY3ApO1xuXG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cblxuICAgIE5ld2xpbmUoY29kZSkge1xuXG4gICAgICAgIHRoaXMubGluZU1hcC5hZGRCcmVhayh0aGlzLm9mZnNldCsrKTtcblxuICAgICAgICAvLyBUcmVhdCAvci9uIGFzIGEgc2luZ2xlIG5ld2xpbmVcbiAgICAgICAgaWYgKGNvZGUgPT09IDEzICYmIHRoaXMucGVla0NvZGUoKSA9PT0gMTApXG4gICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuXG4gICAgICAgIHRoaXMubmV3bGluZUJlZm9yZSA9IHRydWU7XG5cbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfVxuXG4gICAgUHVuY3R1YXRvckNoYXIoKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucmVhZENoYXIoKTtcbiAgICB9XG5cbiAgICBQdW5jdHVhdG9yKCkge1xuXG4gICAgICAgIGxldCBvcCA9IHRoaXMucmVhZENoYXIoKSxcbiAgICAgICAgICAgIGNociA9IFwiXCIsXG4gICAgICAgICAgICBuZXh0ID0gXCJcIjtcblxuICAgICAgICB3aGlsZSAoXG4gICAgICAgICAgICBpc1B1bmN0dWF0b3JOZXh0KGNociA9IHRoaXMucGVla0NoYXIoKSkgJiZcbiAgICAgICAgICAgIG11bHRpQ2hhclB1bmN0dWF0b3IudGVzdChuZXh0ID0gb3AgKyBjaHIpKSB7XG5cbiAgICAgICAgICAgIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgICAgICBvcCA9IG5leHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBcIi4uXCIgaXMgbm90IGEgdmFsaWQgdG9rZW5cbiAgICAgICAgaWYgKG9wID09PSBcIi4uXCIpIHtcblxuICAgICAgICAgICAgdGhpcy5vZmZzZXQtLTtcbiAgICAgICAgICAgIG9wID0gXCIuXCI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3A7XG4gICAgfVxuXG4gICAgVGVtcGxhdGUoKSB7XG5cbiAgICAgICAgbGV0IGZpcnN0ID0gdGhpcy5yZWFkQ2hhcigpLFxuICAgICAgICAgICAgZW5kID0gZmFsc2UsXG4gICAgICAgICAgICB2YWwgPSBcIlwiLFxuICAgICAgICAgICAgZXNjID0gXCJcIixcbiAgICAgICAgICAgIGNociA9IFwiXCI7XG5cbiAgICAgICAgd2hpbGUgKGNociA9IHRoaXMucGVla0NoYXIoKSkge1xuXG4gICAgICAgICAgICBpZiAoY2hyID09PSBcImBcIikge1xuXG4gICAgICAgICAgICAgICAgZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNociA9PT0gXCIkXCIgJiYgdGhpcy5wZWVrQ2hhckF0KDEpID09PSBcIntcIikge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5vZmZzZXQrKztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNociA9PT0gXCJcXFxcXCIpIHtcblxuICAgICAgICAgICAgICAgIGVzYyA9IHRoaXMucmVhZFN0cmluZ0VzY2FwZShcIlxcblwiKTtcblxuICAgICAgICAgICAgICAgIGlmIChlc2MgPT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkVycm9yKCk7XG5cbiAgICAgICAgICAgICAgICB2YWwgKz0gZXNjO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgdmFsICs9IGNocjtcbiAgICAgICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjaHIpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5FcnJvcigpO1xuXG4gICAgICAgIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2YWw7XG4gICAgICAgIHRoaXMudGVtcGxhdGVFbmQgPSBlbmQ7XG5cbiAgICAgICAgcmV0dXJuIFwiVEVNUExBVEVcIjtcbiAgICB9XG5cbiAgICBTdHJpbmcoKSB7XG5cbiAgICAgICAgbGV0IGRlbGltID0gdGhpcy5yZWFkQ2hhcigpLFxuICAgICAgICAgICAgdmFsID0gXCJcIixcbiAgICAgICAgICAgIGVzYyA9IFwiXCIsXG4gICAgICAgICAgICBjaHIgPSBcIlwiO1xuXG4gICAgICAgIHdoaWxlIChjaHIgPSB0aGlzLmlucHV0W3RoaXMub2Zmc2V0XSkge1xuXG4gICAgICAgICAgICBpZiAoY2hyID09PSBkZWxpbSlcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgaWYgKGlzTmV3bGluZUNoYXIoY2hyKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5FcnJvcigpO1xuXG4gICAgICAgICAgICBpZiAoY2hyID09PSBcIlxcXFxcIikge1xuXG4gICAgICAgICAgICAgICAgZXNjID0gdGhpcy5yZWFkU3RyaW5nRXNjYXBlKFwiXCIpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVzYyA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuRXJyb3IoKTtcblxuICAgICAgICAgICAgICAgIHZhbCArPSBlc2M7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICB2YWwgKz0gY2hyO1xuICAgICAgICAgICAgICAgIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWNocilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVycm9yKCk7XG5cbiAgICAgICAgdGhpcy5vZmZzZXQrKztcbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbDtcblxuICAgICAgICByZXR1cm4gXCJTVFJJTkdcIjtcbiAgICB9XG5cbiAgICBSZWd1bGFyRXhwcmVzc2lvbigpIHtcblxuICAgICAgICB0aGlzLm9mZnNldCsrO1xuXG4gICAgICAgIGxldCBiYWNrc2xhc2ggPSBmYWxzZSxcbiAgICAgICAgICAgIGluQ2xhc3MgPSBmYWxzZSxcbiAgICAgICAgICAgIHZhbCA9IFwiXCIsXG4gICAgICAgICAgICBjaHIgPSBcIlwiLFxuICAgICAgICAgICAgY29kZSA9IDAsXG4gICAgICAgICAgICBmbGFnU3RhcnQgPSAwO1xuXG4gICAgICAgIHdoaWxlIChjaHIgPSB0aGlzLnJlYWRDaGFyKCkpIHtcblxuICAgICAgICAgICAgaWYgKGlzTmV3bGluZUNoYXIoY2hyKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5FcnJvcigpO1xuXG4gICAgICAgICAgICBpZiAoYmFja3NsYXNoKSB7XG5cbiAgICAgICAgICAgICAgICB2YWwgKz0gXCJcXFxcXCIgKyBjaHI7XG4gICAgICAgICAgICAgICAgYmFja3NsYXNoID0gZmFsc2U7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hyID09PSBcIltcIikge1xuXG4gICAgICAgICAgICAgICAgaW5DbGFzcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgdmFsICs9IGNocjtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09IFwiXVwiICYmIGluQ2xhc3MpIHtcblxuICAgICAgICAgICAgICAgIGluQ2xhc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB2YWwgKz0gY2hyO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNociA9PT0gXCIvXCIgJiYgIWluQ2xhc3MpIHtcblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNociA9PT0gXCJcXFxcXCIpIHtcblxuICAgICAgICAgICAgICAgIGJhY2tzbGFzaCA9IHRydWU7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICB2YWwgKz0gY2hyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjaHIpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5FcnJvcigpO1xuXG4gICAgICAgIGZsYWdTdGFydCA9IHRoaXMub2Zmc2V0O1xuXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG5cbiAgICAgICAgICAgIGNvZGUgPSB0aGlzLnBlZWtDb2RlKCk7XG5cbiAgICAgICAgICAgIGlmIChjb2RlID09PSA5Mikge1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuRXJyb3IoKTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlID4gMTI3KSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNJZGVudGlmaWVyUGFydChjb2RlID0gdGhpcy5wZWVrQ29kZVBvaW50KCkpKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9mZnNldCArPSBjb2RlUG9pbnRMZW5ndGgoY29kZSk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0lkZW50aWZpZXJQYXJ0QXNjaWkoY29kZSkpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMub2Zmc2V0Kys7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudmFsdWUgPSB2YWw7XG4gICAgICAgIHRoaXMucmVnZXhGbGFncyA9IHRoaXMuaW5wdXQuc2xpY2UoZmxhZ1N0YXJ0LCB0aGlzLm9mZnNldCk7XG5cbiAgICAgICAgcmV0dXJuIFwiUkVHRVhcIjtcbiAgICB9XG5cbiAgICBMZWdhY3lPY3RhbE51bWJlcigpIHtcblxuICAgICAgICB0aGlzLm9mZnNldCsrO1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMub2Zmc2V0LFxuICAgICAgICAgICAgY29kZSA9IDA7XG5cbiAgICAgICAgd2hpbGUgKGNvZGUgPSB0aGlzLnBlZWtDb2RlKCkpIHtcblxuICAgICAgICAgICAgaWYgKGNvZGUgPj0gNDggJiYgY29kZSA8PSA1NSlcbiAgICAgICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdHJpY3RFcnJvciA9IFwiT2N0YWwgbGl0ZXJhbHMgYXJlIG5vdCBhbGxvd2VkIGluIHN0cmljdCBtb2RlXCI7XG5cbiAgICAgICAgbGV0IHZhbCA9IHBhcnNlSW50KHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQsIHRoaXMub2Zmc2V0KSwgOCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLnBlZWtOdW1iZXJGb2xsb3coKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVycm9yKCk7XG5cbiAgICAgICAgdGhpcy5udW1iZXIgPSB2YWw7XG5cbiAgICAgICAgcmV0dXJuIFwiTlVNQkVSXCI7XG4gICAgfVxuXG4gICAgTnVtYmVyKCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMub2Zmc2V0LFxuICAgICAgICAgICAgbmV4dCA9IFwiXCI7XG5cbiAgICAgICAgdGhpcy5yZWFkSW50ZWdlcigpO1xuXG4gICAgICAgIGlmICgobmV4dCA9IHRoaXMucGVla0NoYXIoKSkgPT09IFwiLlwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgICAgICB0aGlzLnJlYWRJbnRlZ2VyKCk7XG4gICAgICAgICAgICBuZXh0ID0gdGhpcy5wZWVrQ2hhcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHQgPT09IFwiZVwiIHx8IG5leHQgPT09IFwiRVwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMub2Zmc2V0Kys7XG5cbiAgICAgICAgICAgIG5leHQgPSB0aGlzLnBlZWtDaGFyKCk7XG5cbiAgICAgICAgICAgIGlmIChuZXh0ID09PSBcIitcIiB8fCBuZXh0ID09PSBcIi1cIilcbiAgICAgICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMucmVhZEludGVnZXIoKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5FcnJvcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHZhbCA9IHBhcnNlRmxvYXQodGhpcy5pbnB1dC5zbGljZShzdGFydCwgdGhpcy5vZmZzZXQpKTtcblxuICAgICAgICBpZiAoIXRoaXMucGVla051bWJlckZvbGxvdygpKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRXJyb3IoKTtcblxuICAgICAgICB0aGlzLm51bWJlciA9IHZhbDtcblxuICAgICAgICByZXR1cm4gXCJOVU1CRVJcIjtcbiAgICB9XG5cbiAgICBCaW5hcnlOdW1iZXIoKSB7XG5cbiAgICAgICAgdGhpcy5vZmZzZXQgKz0gMjtcblxuICAgICAgICBsZXQgdmFsID0gcGFyc2VJbnQodGhpcy5yZWFkUmFuZ2UoNDgsIDQ5KSwgMik7XG5cbiAgICAgICAgaWYgKCF0aGlzLnBlZWtOdW1iZXJGb2xsb3coKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVycm9yKCk7XG5cbiAgICAgICAgdGhpcy5udW1iZXIgPSB2YWw7XG5cbiAgICAgICAgcmV0dXJuIFwiTlVNQkVSXCI7XG4gICAgfVxuXG4gICAgT2N0YWxOdW1iZXIoKSB7XG5cbiAgICAgICAgdGhpcy5vZmZzZXQgKz0gMjtcblxuICAgICAgICBsZXQgdmFsID0gcGFyc2VJbnQodGhpcy5yZWFkUmFuZ2UoNDgsIDU1KSwgOCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLnBlZWtOdW1iZXJGb2xsb3coKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVycm9yKCk7XG5cbiAgICAgICAgdGhpcy5udW1iZXIgPSB2YWw7XG5cbiAgICAgICAgcmV0dXJuIFwiTlVNQkVSXCI7XG4gICAgfVxuXG4gICAgSGV4TnVtYmVyKCkge1xuXG4gICAgICAgIHRoaXMub2Zmc2V0ICs9IDI7XG5cbiAgICAgICAgbGV0IHZhbCA9IHBhcnNlSW50KHRoaXMucmVhZEhleCgwKSwgMTYpO1xuXG4gICAgICAgIGlmICghdGhpcy5wZWVrTnVtYmVyRm9sbG93KCkpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5FcnJvcigpO1xuXG4gICAgICAgIHRoaXMubnVtYmVyID0gdmFsO1xuXG4gICAgICAgIHJldHVybiBcIk5VTUJFUlwiO1xuICAgIH1cblxuICAgIElkZW50aWZpZXIoY29udGV4dCwgY29kZSkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMub2Zmc2V0LFxuICAgICAgICAgICAgdmFsID0gXCJcIixcbiAgICAgICAgICAgIGVzYyA9IFwiXCI7XG5cbiAgICAgICAgLy8gSWRlbnRpZmllciBTdGFydFxuXG4gICAgICAgIGlmIChjb2RlID09PSA5Mikge1xuXG4gICAgICAgICAgICBlc2MgPSB0aGlzLnJlYWRJZGVudGlmaWVyRXNjYXBlKHRydWUpO1xuXG4gICAgICAgICAgICBpZiAoZXNjID09PSBudWxsKVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkVycm9yKCk7XG5cbiAgICAgICAgICAgIHZhbCA9IGVzYztcbiAgICAgICAgICAgIHN0YXJ0ID0gdGhpcy5vZmZzZXQ7XG5cbiAgICAgICAgfSBlbHNlIGlmIChjb2RlID4gMTI3KSB7XG5cbiAgICAgICAgICAgIHRoaXMub2Zmc2V0ICs9IGNvZGVQb2ludExlbmd0aChjb2RlKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWRlbnRpZmllciBQYXJ0XG5cbiAgICAgICAgd2hpbGUgKHRydWUpIHtcblxuICAgICAgICAgICAgY29kZSA9IHRoaXMucGVla0NvZGUoKTtcblxuICAgICAgICAgICAgaWYgKGNvZGUgPT09IDkyKSB7XG5cbiAgICAgICAgICAgICAgICB2YWwgKz0gdGhpcy5pbnB1dC5zbGljZShzdGFydCwgdGhpcy5vZmZzZXQpO1xuICAgICAgICAgICAgICAgIGVzYyA9IHRoaXMucmVhZElkZW50aWZpZXJFc2NhcGUoZmFsc2UpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVzYyA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuRXJyb3IoKTtcblxuICAgICAgICAgICAgICAgIHZhbCArPSBlc2M7XG4gICAgICAgICAgICAgICAgc3RhcnQgPSB0aGlzLm9mZnNldDtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlID4gMTI3KSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNJZGVudGlmaWVyUGFydChjb2RlID0gdGhpcy5wZWVrQ29kZVBvaW50KCkpKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9mZnNldCArPSBjb2RlUG9pbnRMZW5ndGgoY29kZSk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0lkZW50aWZpZXJQYXJ0QXNjaWkoY29kZSkpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMub2Zmc2V0Kys7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhbCArPSB0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCB0aGlzLm9mZnNldCk7XG5cbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbDtcblxuICAgICAgICBpZiAoY29udGV4dCAhPT0gXCJuYW1lXCIgJiYgaXNSZXNlcnZlZFdvcmQodmFsKSlcbiAgICAgICAgICAgIHJldHVybiBlc2MgPyB0aGlzLkVycm9yKCkgOiB2YWw7XG5cbiAgICAgICAgcmV0dXJuIFwiSURFTlRJRklFUlwiO1xuICAgIH1cblxuICAgIEF0TmFtZSgpIHtcblxuICAgICAgICB0aGlzLm9mZnNldCArPSAxO1xuXG4gICAgICAgIGlmICh0aGlzLlN0YXJ0KFwibmFtZVwiKSAhPT0gXCJJREVOVElGSUVSXCIpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5FcnJvcigpO1xuXG4gICAgICAgIC8vIFRPRE86IFRoaXMgaXMgYSBiaXQgb2YgYSBoYWNrXG4gICAgICAgIHRoaXMudmFsdWUgPSBcIkBcIiArIHRoaXMudmFsdWU7XG5cbiAgICAgICAgcmV0dXJuIFwiQVROQU1FXCI7XG4gICAgfVxuXG4gICAgTGluZUNvbW1lbnQoKSB7XG5cbiAgICAgICAgdGhpcy5vZmZzZXQgKz0gMjtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm9mZnNldCxcbiAgICAgICAgICAgIGNociA9IFwiXCI7XG5cbiAgICAgICAgd2hpbGUgKGNociA9IHRoaXMucGVla0NoYXIoKSkge1xuXG4gICAgICAgICAgICBpZiAoaXNOZXdsaW5lQ2hhcihjaHIpKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy52YWx1ZSA9IHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQsIHRoaXMub2Zmc2V0KTtcblxuICAgICAgICByZXR1cm4gXCJDT01NRU5UXCI7XG4gICAgfVxuXG4gICAgQmxvY2tDb21tZW50KCkge1xuXG4gICAgICAgIHRoaXMub2Zmc2V0ICs9IDI7XG5cbiAgICAgICAgbGV0IHBhdHRlcm4gPSBibG9ja0NvbW1lbnRQYXR0ZXJuLFxuICAgICAgICAgICAgc3RhcnQgPSB0aGlzLm9mZnNldDtcblxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuXG4gICAgICAgICAgICBwYXR0ZXJuLmxhc3RJbmRleCA9IHRoaXMub2Zmc2V0O1xuXG4gICAgICAgICAgICBsZXQgbSA9IHBhdHRlcm4uZXhlYyh0aGlzLmlucHV0KTtcbiAgICAgICAgICAgIGlmICghbSkgcmV0dXJuIHRoaXMuRXJyb3IoKTtcblxuICAgICAgICAgICAgdGhpcy5vZmZzZXQgPSBtLmluZGV4ICsgbVswXS5sZW5ndGg7XG5cbiAgICAgICAgICAgIGlmIChtWzBdID09PSBcIiovXCIpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHRoaXMubmV3bGluZUJlZm9yZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmxpbmVNYXAuYWRkQnJlYWsobS5pbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnZhbHVlID0gdGhpcy5pbnB1dC5zbGljZShzdGFydCwgdGhpcy5vZmZzZXQgLSAyKTtcblxuICAgICAgICByZXR1cm4gXCJDT01NRU5UXCI7XG4gICAgfVxuXG4gICAgRU9GKCkge1xuXG4gICAgICAgIHJldHVybiBcIkVPRlwiO1xuICAgIH1cblxuICAgIEVycm9yKG1zZykge1xuXG4gICAgICAgIGlmICh0aGlzLnN0YXJ0ID09PSB0aGlzLm9mZnNldClcbiAgICAgICAgICAgIHRoaXMub2Zmc2V0Kys7XG5cbiAgICAgICAgcmV0dXJuIFwiSUxMRUdBTFwiO1xuICAgIH1cblxufVxuIl19