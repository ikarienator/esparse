"use strict";

// istanbul ignore next
var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

// istanbul ignore next
var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var AST = require("./AST.js");

var Scanner = require("./Scanner.js").Scanner;
var Transform = require("./Transform.js").Transform;
var Validate = require("./Validate.js").Validate;


// Returns true if the specified operator is an increment operator
function isIncrement(op) {
    return op === "++" || op === "--";
}

// Returns a binary operator precedence level
function getPrecedence(op) {
    switch (op) {

        case "||":
            return 1;
        case "&&":
            return 2;
        case "|":
            return 3;
        case "^":
            return 4;
        case "&":
            return 5;
        case "==":
        case "!=":
        case "===":
        case "!==":
            return 6;
        case "<=":
        case ">=":
        case ">":
        case "<":
        case "instanceof":
        case "in":
            return 7;
        case ">>>":
        case ">>":
        case "<<":
            return 8;
        case "+":
        case "-":
            return 9;
        case "*":
        case "/":
        case "%":
            return 10;
    }

    return 0;
}

// Returns true if the specified operator is an assignment operator
function isAssignment(op) {
    if (op === "=") {
        return true;
    }switch (op) {

        case "*=":
        case "&=":
        case "^=":
        case "|=":
        case "<<=":
        case ">>=":
        case ">>>=":
        case "%=":
        case "+=":
        case "-=":
        case "/=":
            return true;
    }

    return false;
}

// Returns true if the specified operator is a unary operator
function isUnary(op) {
    switch (op) {

        case "await":
        case "delete":
        case "void":
        case "typeof":
        case "!":
        case "~":
        case "+":
        case "-":
            return true;
    }

    return false;
}

// Returns true if the value is a function modifier keyword
function isFunctionModifier(value) {
    return value === "async";
}

// Returns true if the value is a generator function modifier keyword
function isGeneratorModifier(value) {
    return value === "async" || value === "";
}

// Returns true if the value is a method definition keyword
function isMethodKeyword(value) {
    switch (value) {

        case "get":
        case "set":
        case "static":
            return true;
    }

    return false;
}

// Returns true if the supplied meta property pair is valid
function isValidMeta(left, right) {
    switch (left) {

        case "new":
            return right === "target";
    }

    return false;
}

// Returns true if the value is a known directive
function isDirective(value) {
    return value === "use strict";
}

// Returns the value of the specified token, if it is an identifier and does not
// contain any unicode escapes
function keywordFromToken(token) {
    if (token.type === "IDENTIFIER" && token.end - token.start === token.value.length) {
        return token.value;
    }return "";
}

// Returns the value of the specified node, if it is an Identifier and does not
// contain any unicode escapes
function keywordFromNode(node) {
    if (node.type === "Identifier" && node.end - node.start === node.value.length) {
        return node.value;
    }return "";
}

// Copies token data
function copyToken(from, to) {
    to.type = from.type;
    to.value = from.value;
    to.number = from.number;
    to.regexFlags = from.regexFlags;
    to.templateEnd = from.templateEnd;
    to.newlineBefore = from.newlineBefore;
    to.strictError = from.strictError;
    to.start = from.start;
    to.end = from.end;

    return to;
}

var Context = function Context(parent) {
    _classCallCheck(this, Context);

    this.parent = parent;
    this.mode = "";
    this.isFunction = false;
    this.functionBody = false;
    this.isGenerator = false;
    this.isAsync = false;
    this.isMethod = false;
    this.isConstructor = false;
    this.hasYieldAwait = false;
    this.labelMap = null;
    this.switchDepth = 0;
    this.loopDepth = 0;
    this.invalidNodes = [];
};

var ParseResult = (function () {
    function ParseResult(input, lineMap, ast) {
        _classCallCheck(this, ParseResult);

        this.input = input;
        this.lineMap = lineMap;
        this.ast = ast;
        this.scopeTree = null;
    }

    _prototypeProperties(ParseResult, null, {
        locate: {
            value: function locate(offset) {
                return this.lineMap.locate(offset);
            },
            writable: true,
            configurable: true
        },
        createSyntaxError: {
            value: function createSyntaxError(message, node) {
                var loc = this.lineMap.locate(node.start),
                    err = new SyntaxError(message);

                err.line = loc.line;
                err.column = loc.column;
                err.lineOffset = loc.lineOffset;
                err.startOffset = node.start;
                err.endOffset = node.end;
                err.sourceText = this.input;

                return err;
            },
            writable: true,
            configurable: true
        }
    });

    return ParseResult;
})();

var Parser = exports.Parser = (function () {
    function Parser() {
        _classCallCheck(this, Parser);
    }

    _prototypeProperties(Parser, null, {
        parse: {
            value: function parse(input, options) {
                options = options || {};

                var scanner = new Scanner(input);

                this.scanner = scanner;
                this.input = input;

                this.peek0 = null;
                this.peek1 = null;
                this.tokenStash = new Scanner();
                this.tokenEnd = scanner.offset;

                this.context = new Context(null, false);
                this.setStrict(false);

                var ast = options.module ? this.Module() : this.Script();

                return new ParseResult(this.input, this.scanner.lineMap, ast);
            },
            writable: true,
            configurable: true
        },
        nextToken: {
            value: function nextToken(context) {
                var scanner = this.scanner,
                    type = "";

                context = context || "";

                do {
                    type = scanner.next(context);
                } while (type === "COMMENT");

                return scanner;
            },
            writable: true,
            configurable: true
        },
        nodeStart: {
            value: function nodeStart() {
                if (this.peek0) {
                    return this.peek0.start;
                } // Skip over whitespace and comments
                this.scanner.skip();

                return this.scanner.offset;
            },
            writable: true,
            configurable: true
        },
        nodeEnd: {
            value: function nodeEnd() {
                return this.tokenEnd;
            },
            writable: true,
            configurable: true
        },
        readToken: {
            value: function readToken(type, context) {
                var token = this.peek0 || this.nextToken(context);

                this.peek0 = this.peek1;
                this.peek1 = null;
                this.tokenEnd = token.end;

                if (type && token.type !== type) this.unexpected(token);

                return token;
            },
            writable: true,
            configurable: true
        },
        read: {
            value: function read(type, context) {
                return this.readToken(type, context).type;
            },
            writable: true,
            configurable: true
        },
        peekToken: {
            value: function peekToken(context) {
                if (!this.peek0) this.peek0 = this.nextToken(context);

                return this.peek0;
            },
            writable: true,
            configurable: true
        },
        peek: {
            value: function peek(context) {
                return this.peekToken(context).type;
            },
            writable: true,
            configurable: true
        },
        peekTokenAt: {
            value: function peekTokenAt(context, index) {
                if (index !== 1 || this.peek0 === null) throw new Error("Invalid lookahead");

                if (this.peek1 === null) {
                    this.peek0 = copyToken(this.peek0, this.tokenStash);
                    this.peek1 = this.nextToken(context);
                }

                return this.peek1;
            },
            writable: true,
            configurable: true
        },
        peekAt: {
            value: function peekAt(context, index) {
                return this.peekTokenAt(context, index).type;
            },
            writable: true,
            configurable: true
        },
        unpeek: {
            value: function unpeek() {
                if (this.peek0) {
                    this.scanner.offset = this.peek0.start;
                    this.peek0 = null;
                    this.peek1 = null;
                }
            },
            writable: true,
            configurable: true
        },
        peekUntil: {
            value: function peekUntil(type, context) {
                var tok = this.peek(context);
                return tok !== "EOF" && tok !== type ? tok : null;
            },
            writable: true,
            configurable: true
        },
        readKeyword: {
            value: function readKeyword(word) {
                var token = this.readToken();

                if (token.type === word || keywordFromToken(token) === word) {
                    return token;
                }this.unexpected(token);
            },
            writable: true,
            configurable: true
        },
        peekKeyword: {
            value: function peekKeyword(word) {
                var token = this.peekToken();
                return token.type === word || keywordFromToken(token) === word;
            },
            writable: true,
            configurable: true
        },
        peekLet: {
            value: function peekLet() {
                if (this.peekKeyword("let")) {
                    switch (this.peekAt("div", 1)) {

                        case "{":
                        case "[":
                        case "IDENTIFIER":
                            return true;
                    }
                }

                return false;
            },
            writable: true,
            configurable: true
        },
        peekYield: {
            value: function peekYield() {
                return this.context.functionBody && this.context.isGenerator && this.peekKeyword("yield");
            },
            writable: true,
            configurable: true
        },
        peekAwait: {
            value: function peekAwait() {
                if (this.peekKeyword("await")) {
                    if (this.context.functionBody && this.context.isAsync) {
                        return true;
                    }if (this.isModule) this.fail("Await is reserved within modules");
                }

                return false;
            },
            writable: true,
            configurable: true
        },
        peekFunctionModifier: {
            value: function peekFunctionModifier() {
                var token = this.peekToken();

                if (!isFunctionModifier(keywordFromToken(token))) {
                    return false;
                }token = this.peekTokenAt("div", 1);
                return token.type === "function" && !token.newlineBefore;
            },
            writable: true,
            configurable: true
        },
        peekEnd: {
            value: function peekEnd() {
                var token = this.peekToken();

                if (!token.newlineBefore) {
                    switch (token.type) {

                        case "EOF":
                        case "}":
                        case ";":
                        case ")":
                            break;

                        default:
                            return false;
                    }
                }

                return true;
            },
            writable: true,
            configurable: true
        },
        unexpected: {
            value: function unexpected(token) {
                var type = token.type,
                    msg = undefined;

                msg = type === "EOF" ? "Unexpected end of input" : "Unexpected token " + token.type;

                this.fail(msg, token);
            },
            writable: true,
            configurable: true
        },
        fail: {
            value: function fail(msg, node) {
                if (!node) node = this.peekToken();

                var result = new ParseResult(this.input, this.scanner.lineMap, null);
                throw result.createSyntaxError(msg, node);
            },
            writable: true,
            configurable: true
        },
        unwrapParens: {
            value: function unwrapParens(node) {
                // Remove any parenthesis surrounding the target
                for (; node.type === "ParenExpression"; node = node.expression);
                return node;
            },
            writable: true,
            configurable: true
        },
        pushContext: {


            // == Context Management ==

            value: function pushContext(isArrow) {
                var parent = this.context,
                    c = new Context(parent);

                this.context = c;

                if (parent.mode === "strict") c.mode = "strict";

                if (isArrow) {
                    c.isMethod = parent.isMethod;
                    c.isConstructor = parent.isConstructor;
                }

                return c;
            },
            writable: true,
            configurable: true
        },
        pushMaybeContext: {
            value: function pushMaybeContext() {
                var parent = this.context,
                    c = this.pushContext();

                c.isFunction = parent.isFunction;
                c.isGenerator = parent.isGenerator;
                c.isAsync = parent.isAsync;
                c.isMethod = parent.isMethod;
                c.isConstructor = parent.isConstructor;
                c.functionBody = parent.functionBody;
            },
            writable: true,
            configurable: true
        },
        popContext: {
            value: function popContext(collapse) {
                var context = this.context,
                    parent = context.parent;

                // If collapsing into parent context, copy invalid nodes into parent
                if (collapse) context.invalidNodes.forEach(function (node) {
                    return parent.invalidNodes.push(node);
                });else this.checkInvalidNodes();

                this.context = this.context.parent;
            },
            writable: true,
            configurable: true
        },
        setStrict: {
            value: function setStrict(strict) {
                this.context.mode = strict ? "strict" : "sloppy";
            },
            writable: true,
            configurable: true
        },
        addStrictError: {
            value: function addStrictError(error, node) {
                this.addInvalidNode(error, node, true);
            },
            writable: true,
            configurable: true
        },
        addInvalidNode: {
            value: function addInvalidNode(error, node, strict) {
                node.error = error;
                this.context.invalidNodes.push({ node: node, strict: !!strict });
            },
            writable: true,
            configurable: true
        },
        setLabel: {
            value: function setLabel(label, value) {
                var m = this.context.labelMap;

                if (!m) m = this.context.labelMap = Object.create(null);

                m[label] = value;
            },
            writable: true,
            configurable: true
        },
        getLabel: {
            value: function getLabel(label) {
                var m = this.context.labelMap;
                return (m && m[label]) | 0;
            },
            writable: true,
            configurable: true
        },
        setFunctionType: {
            value: function setFunctionType(kind) {
                var c = this.context,
                    a = false,
                    g = false;

                switch (kind) {

                    case "async":
                        a = true;break;
                    case "generator":
                        g = true;break;
                    case "async-generator":
                        a = g = true;break;
                }

                c.isFunction = true;
                c.isAsync = a;
                c.isGenerator = g;
            },
            writable: true,
            configurable: true
        },
        Script: {

            // === Top Level ===

            value: function Script() {
                this.isModule = false;
                this.pushContext();

                var start = this.nodeStart(),
                    statements = this.StatementList(true, false);

                this.popContext();

                return new AST.Script(statements, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        Module: {
            value: function Module() {
                this.isModule = true;
                this.pushContext();
                this.setStrict(true);

                var start = this.nodeStart(),
                    statements = this.StatementList(true, true);

                this.popContext();

                return new AST.Module(statements, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        Expression: {

            // === Expressions ===

            value: function Expression(noIn) {
                var expr = this.AssignmentExpression(noIn),
                    list = null;

                while (this.peek("div") === ",") {
                    this.read();

                    if (list === null) expr = new AST.SequenceExpression(list = [expr], expr.start, -1);

                    list.push(this.AssignmentExpression(noIn));
                }

                if (list) expr.end = this.nodeEnd();

                return expr;
            },
            writable: true,
            configurable: true
        },
        AssignmentExpression: {
            value: function AssignmentExpression(noIn, allowSpread) {
                var start = this.nodeStart(),
                    node = undefined;

                if (this.peek() === "...") {
                    this.read();

                    node = new AST.SpreadExpression(this.AssignmentExpression(noIn), start, this.nodeEnd());

                    if (!allowSpread) this.addInvalidNode("Invalid spread expression", node);

                    return node;
                }

                if (this.peekYield()) {
                    return this.YieldExpression(noIn);
                }node = this.ConditionalExpression(noIn);

                if (node.type === "ArrowFunctionHead") {
                    return this.ArrowFunctionBody(node, noIn);
                } // Check for assignment operator
                if (!isAssignment(this.peek("div"))) {
                    return node;
                }this.checkAssignmentTarget(this.unwrapParens(node), false);

                return new AST.AssignmentExpression(this.read(), node, this.AssignmentExpression(noIn), start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        YieldExpression: {
            value: function YieldExpression(noIn) {
                var start = this.nodeStart(),
                    delegate = false,
                    expr = null;

                this.readKeyword("yield");

                if (!this.peekEnd() && this.peek() !== ",") {
                    if (this.peek() === "*") {
                        this.read();
                        delegate = true;
                    }

                    expr = this.AssignmentExpression(noIn);
                }

                this.context.hasYieldAwait = true;

                return new AST.YieldExpression(expr, delegate, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ConditionalExpression: {
            value: function ConditionalExpression(noIn) {
                var start = this.nodeStart(),
                    left = this.BinaryExpression(noIn),
                    middle = undefined,
                    right = undefined;

                if (this.peek("div") !== "?") {
                    return left;
                }this.read("?");
                middle = this.AssignmentExpression();
                this.read(":");
                right = this.AssignmentExpression(noIn);

                return new AST.ConditionalExpression(left, middle, right, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        BinaryExpression: {
            value: function BinaryExpression(noIn) {
                return this.PartialBinaryExpression(this.UnaryExpression(), 0, noIn);
            },
            writable: true,
            configurable: true
        },
        PartialBinaryExpression: {
            value: function PartialBinaryExpression(lhs, minPrec, noIn) {
                var prec = 0,
                    next = "",
                    max = 0,
                    op = "",
                    rhs = undefined;

                while (next = this.peek("div")) {
                    // Exit if operator is "in" and in is not allowed
                    if (next === "in" && noIn) break;

                    prec = getPrecedence(next);

                    // Exit if not a binary operator or lower precendence
                    if (prec === 0 || prec < minPrec) break;

                    this.read();

                    op = next;
                    max = prec;
                    rhs = this.UnaryExpression();

                    while (next = this.peek("div")) {
                        prec = getPrecedence(next);

                        // Exit if not a binary operator or equal or higher precendence
                        if (prec === 0 || prec <= max) break;

                        rhs = this.PartialBinaryExpression(rhs, prec, noIn);
                    }

                    lhs = new AST.BinaryExpression(op, lhs, rhs, lhs.start, rhs.end);
                }

                return lhs;
            },
            writable: true,
            configurable: true
        },
        UnaryExpression: {
            value: function UnaryExpression() {
                var start = this.nodeStart(),
                    type = this.peek(),
                    token = undefined,
                    expr = undefined;

                if (isIncrement(type)) {
                    this.read();
                    expr = this.MemberExpression(true);
                    this.checkAssignmentTarget(this.unwrapParens(expr), true);

                    return new AST.UpdateExpression(type, expr, true, start, this.nodeEnd());
                }

                if (this.peekAwait()) {
                    type = "await";
                    this.context.hasYieldAwait = true;
                }

                if (isUnary(type)) {
                    this.read();
                    expr = this.UnaryExpression();

                    if (type === "delete") this.checkDelete(expr);

                    return new AST.UnaryExpression(type, expr, start, this.nodeEnd());
                }

                expr = this.MemberExpression(true);
                token = this.peekToken("div");
                type = token.type;

                // Check for postfix operator
                if (isIncrement(type) && !token.newlineBefore) {
                    this.read();
                    this.checkAssignmentTarget(this.unwrapParens(expr), true);

                    return new AST.UpdateExpression(type, expr, false, start, this.nodeEnd());
                }

                return expr;
            },
            writable: true,
            configurable: true
        },
        MemberExpression: {
            value: function MemberExpression(allowCall) {
                var token = this.peekToken(),
                    start = token.start,
                    arrowType = "",
                    isSuper = false,
                    exit = false,
                    expr = undefined,
                    prop = undefined;

                switch (token.type) {

                    case "super":


                        expr = this.SuperKeyword();
                        isSuper = true;
                        break;

                    case "new":


                        expr = this.peekAt("", 1) === "." ? this.MetaProperty() : this.NewExpression();

                        break;

                    case "::":


                        if (allowCall) {
                            expr = null;
                            break;
                        }

                    default:


                        expr = this.PrimaryExpression();
                        break;
                }

                while (!exit) {
                    token = this.peekToken("div");

                    switch (token.type) {

                        case ".":


                            this.read();

                            prop = this.peek("name") === "ATNAME" && !isSuper ? this.AtName() : this.IdentifierName();

                            expr = new AST.MemberExpression(expr, prop, false, start, this.nodeEnd());

                            break;

                        case "[":


                            this.read();
                            prop = this.Expression();
                            this.read("]");

                            expr = new AST.MemberExpression(expr, prop, true, start, this.nodeEnd());

                            break;

                        case "(":


                            if (isSuper) {
                                if (!allowCall || !this.context.isConstructor) this.fail("Invalid super call");
                            }

                            if (!allowCall) {
                                exit = true;
                                break;
                            }

                            if (isFunctionModifier(keywordFromNode(expr))) {
                                arrowType = expr.value;
                                this.pushMaybeContext();
                            }

                            expr = new AST.CallExpression(expr, this.ArgumentList(), start, this.nodeEnd());

                            if (arrowType) {
                                token = this.peekToken("div");

                                if (token.type === "=>" && !token.newlineBefore) {
                                    expr = this.ArrowFunctionHead(arrowType, expr, start);
                                    exit = true;
                                } else {
                                    arrowType = "";
                                    this.popContext(true);
                                }
                            }

                            break;

                        case "TEMPLATE":


                            if (isSuper) this.fail();

                            expr = new AST.TaggedTemplateExpression(expr, this.TemplateExpression(), start, this.nodeEnd());

                            break;

                        case "::":


                            if (isSuper) this.fail();

                            if (!allowCall) {
                                exit = true;
                                break;
                            }

                            this.read();

                            expr = new AST.BindExpression(expr, this.MemberExpression(false), start, this.nodeEnd());

                            break;

                        default:


                            if (isSuper) this.fail();

                            exit = true;
                            break;
                    }

                    isSuper = false;
                }

                return expr;
            },
            writable: true,
            configurable: true
        },
        NewExpression: {
            value: function NewExpression() {
                var start = this.nodeStart();

                this.read("new");

                var expr = this.MemberExpression(false),
                    args = this.peek("div") === "(" ? this.ArgumentList() : null;

                return new AST.NewExpression(expr, args, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        MetaProperty: {
            value: function MetaProperty() {
                var token = this.readToken(),
                    start = token.start,
                    left = token.type === "IDENTIFIER" ? token.value : token.type,
                    right = undefined;

                this.read(".");

                token = this.readToken("IDENTIFIER", "name");
                right = token.value;

                if (!isValidMeta(left, right)) this.fail("Invalid meta property", token);

                return new AST.MetaProperty(left, right, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        SuperKeyword: {
            value: function SuperKeyword() {
                var token = this.readToken("super"),
                    node = new AST.SuperKeyword(token.start, token.end);

                if (!this.context.isMethod) this.fail("Super keyword outside of method", node);

                return node;
            },
            writable: true,
            configurable: true
        },
        ArgumentList: {
            value: function ArgumentList() {
                var list = [];

                this.read("(");

                while (this.peekUntil(")")) {
                    if (list.length > 0) this.read(",");

                    list.push(this.AssignmentExpression(false, true));
                }

                this.read(")");

                return list;
            },
            writable: true,
            configurable: true
        },
        PrimaryExpression: {
            value: function PrimaryExpression() {
                var token = this.peekToken(),
                    type = token.type,
                    start = this.nodeStart(),
                    next = undefined,
                    value = undefined;

                switch (type) {

                    case "function":
                        return this.FunctionExpression();
                    case "class":
                        return this.ClassExpression();
                    case "TEMPLATE":
                        return this.TemplateExpression();
                    case "NUMBER":
                        return this.NumberLiteral();
                    case "STRING":
                        return this.StringLiteral();
                    case "{":
                        return this.ObjectLiteral();
                    case "(":
                        return this.ParenExpression();
                    case "[":
                        return this.ArrayLiteral();
                    case "ATNAME":
                        return this.AtName();

                    case "IDENTIFIER":


                        value = keywordFromToken(token);
                        next = this.peekTokenAt("div", 1);

                        if (!next.newlineBefore) {
                            if (next.type === "=>") {
                                this.pushContext(true);
                                return this.ArrowFunctionHead("", this.BindingIdentifier(), start);
                            } else if (next.type === "function") {
                                return this.FunctionExpression();
                            } else if (next.type === "IDENTIFIER" && isFunctionModifier(value)) {
                                this.read();
                                this.pushContext(true);
                                return this.ArrowFunctionHead(value, this.BindingIdentifier(), start);
                            }
                        }

                        return this.Identifier(true);

                    case "REGEX":
                        return this.RegularExpression();

                    case "null":
                        this.read();
                        return new AST.NullLiteral(token.start, token.end);

                    case "true":
                    case "false":
                        this.read();
                        return new AST.BooleanLiteral(type === "true", token.start, token.end);

                    case "this":
                        this.read();
                        return new AST.ThisExpression(token.start, token.end);
                }

                this.unexpected(token);
            },
            writable: true,
            configurable: true
        },
        Identifier: {
            value: function Identifier(isVar) {
                var token = this.readToken("IDENTIFIER"),
                    node = new AST.Identifier(token.value, isVar ? "variable" : "", token.start, token.end);

                this.checkIdentifier(node);
                return node;
            },
            writable: true,
            configurable: true
        },
        IdentifierName: {
            value: function IdentifierName() {
                var token = this.readToken("IDENTIFIER", "name");
                return new AST.Identifier(token.value, "", token.start, token.end);
            },
            writable: true,
            configurable: true
        },
        AtName: {
            value: function AtName() {
                // TODO:  Only allow within class?  What about nested classes?

                var token = this.readToken("ATNAME");
                return new AST.AtName(token.value, token.start, token.end);
            },
            writable: true,
            configurable: true
        },
        StringLiteral: {
            value: function StringLiteral() {
                var token = this.readToken("STRING"),
                    node = new AST.StringLiteral(token.value, token.start, token.end);

                if (token.strictError) this.addStrictError(token.strictError, node);

                return node;
            },
            writable: true,
            configurable: true
        },
        NumberLiteral: {
            value: function NumberLiteral() {
                var token = this.readToken("NUMBER"),
                    node = new AST.NumberLiteral(token.number, token.start, token.end);

                if (token.strictError) this.addStrictError(token.strictError, node);

                return node;
            },
            writable: true,
            configurable: true
        },
        TemplatePart: {
            value: function TemplatePart() {
                var token = this.readToken("TEMPLATE", "template"),
                    end = token.templateEnd,
                    node = undefined;

                node = new AST.TemplatePart(token.value, this.scanner.rawValue(token.start + 1, token.end - (end ? 1 : 2)), end, token.start, token.end);

                if (token.strictError) this.addStrictError(token.strictError, node);

                return node;
            },
            writable: true,
            configurable: true
        },
        RegularExpression: {
            value: function RegularExpression() {
                // TODO:  Validate regular expression against RegExp grammar (21.2.1)
                var token = this.readToken("REGEX");

                return new AST.RegularExpression(token.value, token.regexFlags, token.start, token.end);
            },
            writable: true,
            configurable: true
        },
        BindingIdentifier: {
            value: function BindingIdentifier() {
                var token = this.readToken("IDENTIFIER"),
                    node = new AST.Identifier(token.value, "", token.start, token.end);

                this.checkBindingTarget(node);
                return node;
            },
            writable: true,
            configurable: true
        },
        BindingPattern: {
            value: function BindingPattern() {
                var node = undefined;

                switch (this.peek()) {

                    case "{":
                        node = this.ObjectLiteral();
                        break;

                    case "[":
                        node = this.ArrayLiteral();
                        break;

                    default:
                        return this.BindingIdentifier();
                }

                this.checkBindingTarget(node);
                return node;
            },
            writable: true,
            configurable: true
        },
        ParenExpression: {
            value: function ParenExpression() {
                var start = this.nodeStart(),
                    expr = null,
                    rest = null;

                // Push a new context in case we are parsing an arrow function
                this.pushMaybeContext();

                this.read("(");

                switch (this.peek()) {

                    // An empty arrow function formal list
                    case ")":
                        break;

                    // Paren expression
                    default:
                        expr = this.Expression();
                        break;
                }

                this.read(")");

                var next = this.peekToken("div");

                if (!next.newlineBefore && (next.type === "=>" || expr === null)) {
                    return this.ArrowFunctionHead("", expr, start);
                } // Collapse this context into its parent
                this.popContext(true);

                return new AST.ParenExpression(expr, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ObjectLiteral: {
            value: function ObjectLiteral() {
                var start = this.nodeStart(),
                    comma = false,
                    list = [],
                    node = undefined;

                this.read("{");

                while (this.peekUntil("}", "name")) {
                    if (!comma && node) {
                        this.read(",");
                        comma = true;
                    } else {
                        comma = false;
                        list.push(node = this.PropertyDefinition());
                    }
                }

                this.read("}");

                return new AST.ObjectLiteral(list, comma, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        PropertyDefinition: {
            value: function PropertyDefinition() {
                if (this.peek("name") === "*") {
                    return this.MethodDefinition();
                }var start = this.nodeStart(),
                    node = undefined,
                    name = undefined;

                switch (this.peekAt("name", 1)) {

                    case "=":


                        // Re-read token as an identifier
                        this.unpeek();

                        node = new AST.PatternProperty(this.Identifier(true), null, (this.read(), this.AssignmentExpression()), start, this.nodeEnd());

                        this.addInvalidNode("Invalid property definition in object literal", node);
                        return node;

                    case ",":
                    case "}":


                        // Re-read token as an identifier
                        this.unpeek();

                        return new AST.PropertyDefinition(this.Identifier(true), null, start, this.nodeEnd());
                }

                name = this.PropertyName();

                if (this.peek("name") === ":") {
                    return new AST.PropertyDefinition(name, (this.read(), this.AssignmentExpression()), start, this.nodeEnd());
                }

                return this.MethodDefinition(name);
            },
            writable: true,
            configurable: true
        },
        PropertyName: {
            value: function PropertyName() {
                var token = this.peekToken("name");

                switch (token.type) {

                    case "IDENTIFIER":
                        return this.IdentifierName();
                    case "STRING":
                        return this.StringLiteral();
                    case "NUMBER":
                        return this.NumberLiteral();
                    case "[":
                        return this.ComputedPropertyName();
                }

                this.unexpected(token);
            },
            writable: true,
            configurable: true
        },
        ComputedPropertyName: {
            value: function ComputedPropertyName() {
                var start = this.nodeStart();

                this.read("[");
                var expr = this.AssignmentExpression();
                this.read("]");

                return new AST.ComputedPropertyName(expr, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ArrayLiteral: {
            value: function ArrayLiteral() {
                var start = this.nodeStart(),
                    comma = false,
                    list = [],
                    type = undefined;

                this.read("[");

                while (type = this.peekUntil("]")) {
                    if (type === ",") {
                        this.read();
                        comma = true;
                        list.push(null);
                    } else {
                        list.push(this.AssignmentExpression(false, true));
                        comma = false;

                        if (this.peek() !== "]") {
                            this.read(",");
                            comma = true;
                        }
                    }
                }

                this.read("]");

                return new AST.ArrayLiteral(list, comma, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        TemplateExpression: {
            value: function TemplateExpression() {
                var atom = this.TemplatePart(),
                    start = atom.start,
                    lit = [atom],
                    sub = [];

                while (!atom.templateEnd) {
                    sub.push(this.Expression());

                    // Discard any tokens that have been scanned using a different context
                    this.unpeek();

                    lit.push(atom = this.TemplatePart());
                }

                return new AST.TemplateExpression(lit, sub, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        Statement: {

            // === Statements ===

            value: function Statement(label) {
                var next = undefined;

                switch (this.peek()) {

                    case "IDENTIFIER":


                        if (this.peekAt("div", 1) === ":") {
                            return this.LabelledStatement();
                        }return this.ExpressionStatement();

                    case "{":
                        return this.Block();
                    case ";":
                        return this.EmptyStatement();
                    case "var":
                        return this.VariableStatement();
                    case "return":
                        return this.ReturnStatement();
                    case "break":
                        return this.BreakStatement();
                    case "continue":
                        return this.ContinueStatement();
                    case "throw":
                        return this.ThrowStatement();
                    case "debugger":
                        return this.DebuggerStatement();
                    case "if":
                        return this.IfStatement();
                    case "do":
                        return this.DoWhileStatement(label);
                    case "while":
                        return this.WhileStatement(label);
                    case "for":
                        return this.ForStatement(label);
                    case "with":
                        return this.WithStatement();
                    case "switch":
                        return this.SwitchStatement();
                    case "try":
                        return this.TryStatement();

                    default:
                        return this.ExpressionStatement();
                }
            },
            writable: true,
            configurable: true
        },
        Block: {
            value: function Block() {
                var start = this.nodeStart();

                this.read("{");
                var list = this.StatementList(false, false);
                this.read("}");

                return new AST.Block(list, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        Semicolon: {
            value: function Semicolon() {
                var token = this.peekToken(),
                    type = token.type;

                if (type === ";" || !(type === "}" || type === "EOF" || token.newlineBefore)) this.read(";");
            },
            writable: true,
            configurable: true
        },
        LabelledStatement: {
            value: function LabelledStatement() {
                var start = this.nodeStart(),
                    label = this.Identifier(),
                    name = label.value;

                if (this.getLabel(name) > 0) this.fail("Invalid label", label);

                this.read(":");

                this.setLabel(name, 1);
                var statement = this.Statement(name);
                this.setLabel(name, 0);

                return new AST.LabelledStatement(label, statement, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ExpressionStatement: {
            value: function ExpressionStatement() {
                var start = this.nodeStart(),
                    expr = this.Expression();

                this.Semicolon();

                return new AST.ExpressionStatement(expr, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        EmptyStatement: {
            value: function EmptyStatement() {
                var start = this.nodeStart();

                this.Semicolon();

                return new AST.EmptyStatement(start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        VariableStatement: {
            value: function VariableStatement() {
                var node = this.VariableDeclaration(false);

                this.Semicolon();
                node.end = this.nodeEnd();

                return node;
            },
            writable: true,
            configurable: true
        },
        VariableDeclaration: {
            value: function VariableDeclaration(noIn) {
                var start = this.nodeStart(),
                    token = this.peekToken(),
                    kind = token.type,
                    list = [];

                switch (kind) {

                    case "var":
                    case "const":
                        break;

                    case "IDENTIFIER":


                        if (token.value === "let") {
                            kind = "let";
                            break;
                        }

                    default:
                        this.fail("Expected var, const, or let");
                }

                this.read();

                while (true) {
                    list.push(this.VariableDeclarator(noIn, kind));

                    if (this.peek() === ",") this.read();else break;
                }

                return new AST.VariableDeclaration(kind, list, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        VariableDeclarator: {
            value: function VariableDeclarator(noIn, kind) {
                var start = this.nodeStart(),
                    pattern = this.BindingPattern(),
                    init = null;

                if (!noIn && pattern.type !== "Identifier" || this.peek() === "=") {
                    // NOTE: Patterns must have initializers when not in declaration
                    // section of a for statement

                    this.read();
                    init = this.AssignmentExpression(noIn);
                } else if (kind === "const") {
                    this.fail("Missing const initializer", pattern);
                }

                return new AST.VariableDeclarator(pattern, init, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ReturnStatement: {
            value: function ReturnStatement() {
                if (!this.context.isFunction) this.fail("Return statement outside of function");

                var start = this.nodeStart();

                this.read("return");
                var value = this.peekEnd() ? null : this.Expression();

                this.Semicolon();

                return new AST.ReturnStatement(value, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        BreakStatement: {
            value: function BreakStatement() {
                var start = this.nodeStart(),
                    context = this.context;

                this.read("break");
                var label = this.peekEnd() ? null : this.Identifier();
                this.Semicolon();

                var node = new AST.BreakStatement(label, start, this.nodeEnd());

                if (label) {
                    if (this.getLabel(label.value) === 0) this.fail("Invalid label", label);
                } else if (context.loopDepth === 0 && context.switchDepth === 0) {
                    this.fail("Break not contained within a switch or loop", node);
                }

                return node;
            },
            writable: true,
            configurable: true
        },
        ContinueStatement: {
            value: function ContinueStatement() {
                var start = this.nodeStart(),
                    context = this.context;

                this.read("continue");
                var label = this.peekEnd() ? null : this.Identifier();
                this.Semicolon();

                var node = new AST.ContinueStatement(label, start, this.nodeEnd());

                if (label) {
                    if (this.getLabel(label.value) !== 2) this.fail("Invalid label", label);
                } else if (context.loopDepth === 0) {
                    this.fail("Continue not contained within a loop", node);
                }

                return node;
            },
            writable: true,
            configurable: true
        },
        ThrowStatement: {
            value: function ThrowStatement() {
                var start = this.nodeStart();

                this.read("throw");

                var expr = this.peekEnd() ? null : this.Expression();

                if (expr === null) this.fail("Missing throw expression");

                this.Semicolon();

                return new AST.ThrowStatement(expr, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        DebuggerStatement: {
            value: function DebuggerStatement() {
                var start = this.nodeStart();

                this.read("debugger");
                this.Semicolon();

                return new AST.DebuggerStatement(start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        IfStatement: {
            value: function IfStatement() {
                var start = this.nodeStart();

                this.read("if");
                this.read("(");

                var test = this.Expression(),
                    body = null,
                    elseBody = null;

                this.read(")");
                body = this.Statement();

                if (this.peek() === "else") {
                    this.read();
                    elseBody = this.Statement();
                }

                return new AST.IfStatement(test, body, elseBody, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        DoWhileStatement: {
            value: function DoWhileStatement(label) {
                var start = this.nodeStart(),
                    body = undefined,
                    test = undefined;

                if (label) this.setLabel(label, 2);

                this.read("do");

                this.context.loopDepth += 1;
                body = this.Statement();
                this.context.loopDepth -= 1;

                this.read("while");
                this.read("(");

                test = this.Expression();

                this.read(")");

                return new AST.DoWhileStatement(body, test, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        WhileStatement: {
            value: function WhileStatement(label) {
                var start = this.nodeStart();

                if (label) this.setLabel(label, 2);

                this.read("while");
                this.read("(");
                var expr = this.Expression();
                this.read(")");

                this.context.loopDepth += 1;
                var statement = this.Statement();
                this.context.loopDepth -= 1;

                return new AST.WhileStatement(expr, statement, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ForStatement: {
            value: function ForStatement(label) {
                var start = this.nodeStart(),
                    init = null,
                    async = false,
                    test = undefined,
                    step = undefined;

                if (label) this.setLabel(label, 2);

                this.read("for");

                if (this.context.isAsync && this.peekKeyword("async")) {
                    this.read();
                    async = true;
                }

                this.read("(");

                // Get loop initializer
                switch (this.peek()) {

                    case ";":
                        break;

                    case "var":
                    case "const":
                        init = this.VariableDeclaration(true);
                        break;

                    case "IDENTIFIER":


                        if (this.peekLet()) {
                            init = this.VariableDeclaration(true);
                            break;
                        }

                    default:
                        init = this.Expression(true);
                        break;
                }

                if (async || init && this.peekKeyword("of")) {
                    return this.ForOfStatement(async, init, start);
                }if (init && this.peek() === "in") {
                    return this.ForInStatement(init, start);
                }this.read(";");
                test = this.peek() === ";" ? null : this.Expression();

                this.read(";");
                step = this.peek() === ")" ? null : this.Expression();

                this.read(")");

                this.context.loopDepth += 1;
                var statement = this.Statement();
                this.context.loopDepth -= 1;

                return new AST.ForStatement(init, test, step, statement, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ForInStatement: {
            value: function ForInStatement(init, start) {
                this.checkForInit(init, "in");

                this.read("in");
                var expr = this.Expression();
                this.read(")");

                this.context.loopDepth += 1;
                var statement = this.Statement();
                this.context.loopDepth -= 1;

                return new AST.ForInStatement(init, expr, statement, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ForOfStatement: {
            value: function ForOfStatement(async, init, start) {
                this.checkForInit(init, "of");

                this.readKeyword("of");
                var expr = this.AssignmentExpression();
                this.read(")");

                this.context.loopDepth += 1;
                var statement = this.Statement();
                this.context.loopDepth -= 1;

                return new AST.ForOfStatement(async, init, expr, statement, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        WithStatement: {
            value: function WithStatement() {
                var start = this.nodeStart();

                this.read("with");
                this.read("(");

                var node = new AST.WithStatement(this.Expression(), (this.read(")"), this.Statement()), start, this.nodeEnd());

                this.addStrictError("With statement is not allowed in strict mode", node);

                return node;
            },
            writable: true,
            configurable: true
        },
        SwitchStatement: {
            value: function SwitchStatement() {
                var start = this.nodeStart();

                this.read("switch");
                this.read("(");

                var head = this.Expression(),
                    hasDefault = false,
                    cases = [],
                    node = undefined;

                this.read(")");
                this.read("{");
                this.context.switchDepth += 1;

                while (this.peekUntil("}")) {
                    node = this.SwitchCase();

                    if (node.test === null) {
                        if (hasDefault) this.fail("Switch statement cannot have more than one default", node);

                        hasDefault = true;
                    }

                    cases.push(node);
                }

                this.context.switchDepth -= 1;
                this.read("}");

                return new AST.SwitchStatement(head, cases, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        SwitchCase: {
            value: function SwitchCase() {
                var start = this.nodeStart(),
                    expr = null,
                    list = [],
                    type = undefined;

                if (this.peek() === "default") {
                    this.read();
                } else {
                    this.read("case");
                    expr = this.Expression();
                }

                this.read(":");

                while (type = this.peekUntil("}")) {
                    if (type === "case" || type === "default") break;

                    list.push(this.Declaration(false));
                }

                return new AST.SwitchCase(expr, list, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        TryStatement: {
            value: function TryStatement() {
                var start = this.nodeStart();

                this.read("try");

                var tryBlock = this.Block(),
                    handler = null,
                    fin = null;

                if (this.peek() === "catch") handler = this.CatchClause();

                if (this.peek() === "finally") {
                    this.read("finally");
                    fin = this.Block();
                }

                return new AST.TryStatement(tryBlock, handler, fin, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        CatchClause: {
            value: function CatchClause() {
                var start = this.nodeStart();

                this.read("catch");
                this.read("(");
                var param = this.BindingPattern();
                this.read(")");

                return new AST.CatchClause(param, this.Block(), start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        StatementList: {

            // === Declarations ===

            value: function StatementList(prologue, isModule) {
                var list = [],
                    node = undefined,
                    expr = undefined,
                    dir = undefined;

                // TODO: is this wrong for braceless statement lists?
                while (this.peekUntil("}")) {
                    node = this.Declaration(isModule);

                    // Check for directives
                    if (prologue) {
                        if (node.type === "ExpressionStatement" && node.expression.type === "StringLiteral") {
                            // Get the non-escaped literal text of the string
                            expr = node.expression;
                            dir = this.input.slice(expr.start + 1, expr.end - 1);

                            if (isDirective(dir)) {
                                node = new AST.Directive(dir, expr, node.start, node.end);

                                // Check for strict mode
                                if (dir === "use strict") this.setStrict(true);
                            }
                        } else {
                            prologue = false;
                        }
                    }

                    list.push(node);
                }

                return list;
            },
            writable: true,
            configurable: true
        },
        Declaration: {
            value: function Declaration(isModule) {
                switch (this.peek()) {

                    case "function":
                        return this.FunctionDeclaration();
                    case "class":
                        return this.ClassDeclaration();
                    case "const":
                        return this.LexicalDeclaration();

                    case "import":


                        if (isModule) {
                            return this.ImportDeclaration();
                        }case "export":


                        if (isModule) {
                            return this.ExportDeclaration();
                        }break;

                    case "IDENTIFIER":


                        if (this.peekLet()) {
                            return this.LexicalDeclaration();
                        }if (this.peekFunctionModifier()) {
                            return this.FunctionDeclaration();
                        }break;
                }

                return this.Statement();
            },
            writable: true,
            configurable: true
        },
        LexicalDeclaration: {
            value: function LexicalDeclaration() {
                var node = this.VariableDeclaration(false);

                this.Semicolon();
                node.end = this.nodeEnd();

                return node;
            },
            writable: true,
            configurable: true
        },
        FunctionDeclaration: {

            // === Functions ===

            value: function FunctionDeclaration() {
                var start = this.nodeStart(),
                    kind = "",
                    tok = undefined;

                tok = this.peekToken();

                if (isFunctionModifier(keywordFromToken(tok))) {
                    this.read();
                    kind = tok.value;
                }

                this.read("function");

                if (isGeneratorModifier(kind) && this.peek() === "*") {
                    this.read();
                    kind = kind ? kind + "-generator" : "generator";
                }

                this.pushContext();
                this.setFunctionType(kind);

                var ident = this.BindingIdentifier(),
                    params = this.FormalParameters(),
                    body = this.FunctionBody();

                this.checkParameters(params);
                this.popContext();

                return new AST.FunctionDeclaration(kind, ident, params, body, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        FunctionExpression: {
            value: function FunctionExpression() {
                var start = this.nodeStart(),
                    ident = null,
                    kind = "",
                    tok = undefined;

                tok = this.peekToken();

                if (isFunctionModifier(keywordFromToken(tok))) {
                    this.read();
                    kind = tok.value;
                }

                this.read("function");

                if (isGeneratorModifier(kind) && this.peek() === "*") {
                    this.read();
                    kind = kind ? kind + "-generator" : "generator";
                }

                this.pushContext();
                this.setFunctionType(kind);

                if (this.peek() !== "(") ident = this.BindingIdentifier();

                var params = this.FormalParameters(),
                    body = this.FunctionBody();

                this.checkParameters(params);
                this.popContext();

                return new AST.FunctionExpression(kind, ident, params, body, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        MethodDefinition: {
            value: function MethodDefinition(name, classElement) {
                var start = name ? name.start : this.nodeStart(),
                    isStatic = false,
                    kind = "",
                    val = undefined;

                if (!name && classElement && this.peekToken("name").value === "static" && this.peekAt("name", 1) !== "(") {
                    this.read();
                    isStatic = true;
                }

                if (!name && this.peek("name") === "*") {
                    this.read();

                    kind = "generator";
                    name = this.PropertyName();
                } else {
                    if (!name) name = this.PropertyName();

                    val = keywordFromNode(name);

                    if (this.peek("name") !== "(") {
                        if (val === "get" || val === "set" || isFunctionModifier(val)) {
                            kind = name.value;

                            if (isGeneratorModifier(kind) && this.peek("name") === "*") {
                                this.read();
                                kind += "-generator";
                            }

                            name = this.PropertyName();
                        }
                    }
                }

                if (classElement) {
                    if (isStatic) {
                        if (name.type === "Identifier" && name.value === "prototype") this.fail("Invalid prototype property in class definition", name);
                    } else if (name.type === "Identifier" && name.value === "constructor") {
                        if (kind !== "") this.fail("Invalid constructor property in class definition", name);

                        kind = "constructor";
                    }
                }

                this.pushContext();
                this.setFunctionType(kind);
                this.context.isMethod = true;
                this.context.isConstructor = kind === "constructor";

                var params = kind === "get" || kind === "set" ? this.AccessorParameters(kind) : this.FormalParameters();

                var body = this.FunctionBody();

                this.checkParameters(params);
                this.popContext();

                return new AST.MethodDefinition(isStatic, kind, name, params, body, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        AccessorParameters: {
            value: function AccessorParameters(kind) {
                var list = [];

                this.read("(");

                if (kind === "set") list.push(this.FormalParameter(false));

                this.read(")");

                return list;
            },
            writable: true,
            configurable: true
        },
        FormalParameters: {
            value: function FormalParameters() {
                var list = [];

                this.read("(");

                while (this.peekUntil(")")) {
                    if (list.length > 0) this.read(",");

                    // Parameter list may have a trailing rest parameter
                    if (this.peek() === "...") {
                        list.push(this.RestParameter());
                        break;
                    }

                    list.push(this.FormalParameter(true));
                }

                this.read(")");

                return list;
            },
            writable: true,
            configurable: true
        },
        FormalParameter: {
            value: function FormalParameter(allowDefault) {
                var start = this.nodeStart(),
                    pattern = this.BindingPattern(),
                    init = null;

                if (allowDefault && this.peek() === "=") {
                    this.read();
                    init = this.AssignmentExpression();
                }

                return new AST.FormalParameter(pattern, init, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        RestParameter: {
            value: function RestParameter() {
                var start = this.nodeStart();

                this.read("...");

                return new AST.RestParameter(this.BindingIdentifier(), start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        FunctionBody: {
            value: function FunctionBody() {
                this.context.functionBody = true;

                var start = this.nodeStart();

                this.read("{");
                var statements = this.StatementList(true, false);
                this.read("}");

                return new AST.FunctionBody(statements, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ArrowFunctionHead: {
            value: function ArrowFunctionHead(kind, formals, start) {
                // Context must have been pushed by caller
                this.setFunctionType(kind);

                if (this.context.hasYieldAwait) this.fail("Invalid yield or await within arrow function head");

                // Transform and validate formal parameters
                var params = this.checkArrowParameters(formals);

                return new AST.ArrowFunctionHead(params, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ArrowFunctionBody: {
            value: function ArrowFunctionBody(head, noIn) {
                this.read("=>");

                var params = head.parameters,
                    start = head.start,
                    kind = this.context.isAsync ? "async" : "";

                // Use function body context even if parsing expression body form
                this.context.functionBody = true;

                var body = this.peek() === "{" ? this.FunctionBody() : this.AssignmentExpression(noIn);

                this.popContext();

                return new AST.ArrowFunction(kind, params, body, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ClassDeclaration: {

            // === Classes ===

            value: function ClassDeclaration() {
                var start = this.nodeStart(),
                    ident = null,
                    base = null;

                this.read("class");

                ident = this.BindingIdentifier();

                if (this.peek() === "extends") {
                    this.read();
                    base = this.MemberExpression(true);
                }

                return new AST.ClassDeclaration(ident, base, this.ClassBody(), start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ClassExpression: {
            value: function ClassExpression() {
                var start = this.nodeStart(),
                    ident = null,
                    base = null;

                this.read("class");

                if (this.peek() === "IDENTIFIER") ident = this.BindingIdentifier();

                if (this.peek() === "extends") {
                    this.read();
                    base = this.MemberExpression(true);
                }

                return new AST.ClassExpression(ident, base, this.ClassBody(), start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ClassBody: {
            value: function ClassBody() {
                var start = this.nodeStart(),
                    hasConstructor = false,
                    list = [];

                this.pushContext();
                this.setStrict(true);
                this.read("{");

                while (this.peekUntil("}", "name")) {
                    var elem = this.ClassElement();

                    if (elem.type === "MethodDefinition" && elem.kind === "constructor") {
                        if (hasConstructor) this.fail("Duplicate constructor definitions", elem.name);

                        hasConstructor = true;
                    }

                    list.push(elem);
                }

                this.read("}");
                this.popContext();

                return new AST.ClassBody(list, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        PrivateDeclaration: {
            value: function PrivateDeclaration() {
                var start = this.nodeStart(),
                    name = this.AtName(),
                    init = null;

                if (this.peek() === "=") {
                    this.read();
                    init = this.AssignmentExpression();
                }

                this.Semicolon();

                return new AST.PrivateDeclaration(name, init, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        EmptyClassElement: {
            value: function EmptyClassElement() {
                var start = this.nodeStart();

                this.read(";");

                return new AST.EmptyClassElement(start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ClassElement: {
            value: function ClassElement() {
                var next = this.peekToken("name");

                if (next.type === ";") {
                    return this.EmptyClassElement();
                }if (next.type === "ATNAME") {
                    return this.PrivateDeclaration();
                }if (next.type === "IDENTIFIER" && !isMethodKeyword(next.value) && this.peekAt("name", 1) !== "(") {
                    this.unpeek();

                    switch (this.peek()) {

                        case "class":
                            return this.ClassDeclaration();
                        case "function":
                            return this.FunctionDeclaration();

                        case "var":
                        case "const":
                            return this.LexicalDeclaration();

                        case "IDENTIFIER":


                            if (this.peekLet()) {
                                return this.LexicalDeclaration();
                            }if (this.peekFunctionModifier()) {
                                return this.FunctionDeclaration();
                            }}

                    this.unpeek();
                }

                return this.MethodDefinition(null, true);
            },
            writable: true,
            configurable: true
        },
        ImportDeclaration: {

            // === Modules ===

            value: function ImportDeclaration() {
                var start = this.nodeStart(),
                    imports = null,
                    from = undefined;

                this.read("import");

                switch (this.peek()) {

                    case "*":
                        imports = this.NamespaceImport();
                        break;

                    case "{":
                        imports = this.NamedImports();
                        break;

                    case "STRING":
                        from = this.StringLiteral();
                        break;

                    default:
                        imports = this.DefaultImport();
                        break;
                }

                if (!from) {
                    this.readKeyword("from");
                    from = this.StringLiteral();
                }

                this.Semicolon();

                return new AST.ImportDeclaration(imports, from, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        DefaultImport: {
            value: function DefaultImport() {
                var start = this.nodeStart(),
                    ident = this.BindingIdentifier(),
                    extra = null;

                if (this.peek() === ",") {
                    this.read();

                    switch (this.peek()) {

                        case "*":
                            extra = this.NamespaceImport();
                            break;

                        case "{":
                            extra = this.NamedImports();
                            break;

                        default:
                            this.fail();
                    }
                }

                return new AST.DefaultImport(ident, extra, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        NamespaceImport: {
            value: function NamespaceImport() {
                var start = this.nodeStart(),
                    ident = undefined;

                this.read("*");
                this.readKeyword("as");
                ident = this.BindingIdentifier();

                return new AST.NamespaceImport(ident, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        NamedImports: {
            value: function NamedImports() {
                var start = this.nodeStart(),
                    list = [];

                this.read("{");

                while (this.peekUntil("}")) {
                    list.push(this.ImportSpecifier());

                    if (this.peek() === ",") this.read();
                }

                this.read("}");

                return new AST.NamedImports(list, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ImportSpecifier: {
            value: function ImportSpecifier() {
                var start = this.nodeStart(),
                    hasLocal = false,
                    local = null,
                    remote = undefined;

                if (this.peek() !== "IDENTIFIER") {
                    // Re-scan token as an identifier name
                    this.unpeek();
                    remote = this.IdentifierName();
                    hasLocal = true;
                } else {
                    remote = this.Identifier();
                    hasLocal = this.peekKeyword("as");
                }

                if (hasLocal) {
                    this.readKeyword("as");
                    local = this.BindingIdentifier();
                } else {
                    this.checkBindingTarget(remote);
                }

                return new AST.ImportSpecifier(remote, local, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ExportDeclaration: {
            value: function ExportDeclaration() {
                var start = this.nodeStart(),
                    exports = undefined;

                this.read("export");

                switch (this.peek()) {

                    case "var":
                    case "const":
                        exports = this.LexicalDeclaration();
                        break;

                    case "function":
                        exports = this.FunctionDeclaration();
                        break;

                    case "class":
                        exports = this.ClassDeclaration();
                        break;

                    case "default":
                        exports = this.DefaultExport();
                        break;

                    case "IDENTIFIER":


                        if (this.peekLet()) {
                            exports = this.LexicalDeclaration();
                            break;
                        }

                        if (this.peekFunctionModifier()) {
                            exports = this.FunctionDeclaration();
                            break;
                        }

                    default:
                        exports = this.ExportClause();
                        this.Semicolon();
                        break;
                }

                return new AST.ExportDeclaration(exports, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        DefaultExport: {
            value: function DefaultExport() {
                var start = this.nodeStart(),
                    binding = undefined;

                this.read("default");

                switch (this.peek()) {

                    case "class":
                        binding = this.ClassExpression();
                        break;

                    case "function":
                        binding = this.FunctionExpression();
                        break;

                    case "IDENTIFIER":


                        if (this.peekFunctionModifier()) {
                            binding = this.FunctionExpression();
                            break;
                        }

                    default:
                        binding = this.AssignmentExpression();
                        break;
                }

                var isDecl = this.transformDefaultExport(binding);

                if (!isDecl) this.Semicolon();

                return new AST.DefaultExport(binding, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ExportClause: {
            value: function ExportClause() {
                var _this = this;


                var start = this.nodeStart(),
                    list = null,
                    from = null;

                if (this.peek() === "*") {
                    this.read();
                    this.readKeyword("from");
                    from = this.StringLiteral();
                } else {
                    list = [];

                    this.read("{");

                    while (this.peekUntil("}", "name")) {
                        list.push(this.ExportSpecifier());

                        if (this.peek() === ",") this.read();
                    }

                    this.read("}");

                    if (this.peekKeyword("from")) {
                        this.read();
                        from = this.StringLiteral();
                    } else {
                        // Transform identifier names to identifiers
                        list.forEach(function (node) {
                            return _this.transformIdentifier(node.local);
                        });
                    }
                }

                return new AST.ExportClause(list, from, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        },
        ExportSpecifier: {
            value: function ExportSpecifier() {
                var start = this.nodeStart(),
                    local = this.IdentifierName(),
                    remote = null;

                if (this.peekKeyword("as")) {
                    this.read();
                    remote = this.IdentifierName();
                }

                return new AST.ExportSpecifier(local, remote, start, this.nodeEnd());
            },
            writable: true,
            configurable: true
        }
    });

    return Parser;
})();


function mixin(target) {
    for (var _len = arguments.length, sources = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        sources[_key - 1] = arguments[_key];
    }

    target = target.prototype;

    var ownNames = Object.getOwnPropertyNames;
    var ownDesc = Object.getOwnPropertyDescriptor;
    var hasOwn = Object.prototype.hasOwnProperty;


    sources.map(function (source) {
        return source.prototype;
    }).forEach(function (source) {
        return ownNames(source).filter(function (key) {
            return !hasOwn.call(target, key);
        }).forEach(function (key) {
            return Object.defineProperty(target, key, ownDesc(source, key));
        });
    });
}

// Add externally defined methods
mixin(Parser, Transform, Validate);
//# sourceMappingURL=data:application/json;base64,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QUMsQ0FBQzthQUN4RTs7Ozs7O1dBNzlFUSxNQUFNOzs7O0FBaStFbkIsU0FBUyxLQUFLLENBQUMsTUFBTSxFQUFjO3NDQUFULE9BQU87QUFBUCxlQUFPOzs7QUFFN0IsVUFBTSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7O1FBR0QsUUFBUSxHQUVhLE1BQU0sQ0FGaEQsbUJBQW1CO1FBQ08sT0FBTyxHQUNTLE1BQU0sQ0FEaEQsd0JBQXdCO1FBQ0ssTUFBTSxHQUFPLE1BQU0sQ0FBaEQsU0FBUyxDQUFJLGNBQWM7OztBQUUvQixXQUFPLENBQ04sR0FBRyxDQUFDLFVBQUEsTUFBTTtlQUFJLE1BQU0sQ0FBQyxTQUFTO0tBQUEsQ0FBQyxDQUMvQixPQUFPLENBQUMsVUFBQSxNQUFNO2VBQ1gsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUNmLE1BQU0sQ0FBQyxVQUFBLEdBQUc7bUJBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUM7U0FBQSxDQUFDLENBQ3hDLE9BQU8sQ0FBQyxVQUFBLEdBQUc7bUJBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FBQSxDQUFDO0tBQUEsQ0FBQyxDQUFDO0NBQ2xGOzs7QUFHRCxLQUFLLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyIsImZpbGUiOiJzcmMvUGFyc2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEFTVCBmcm9tIFwiLi9BU1QuanNcIjtcbmltcG9ydCB7IFNjYW5uZXIgfSBmcm9tIFwiLi9TY2FubmVyLmpzXCI7XG5pbXBvcnQgeyBUcmFuc2Zvcm0gfSBmcm9tIFwiLi9UcmFuc2Zvcm0uanNcIjtcbmltcG9ydCB7IFZhbGlkYXRlIH0gZnJvbSBcIi4vVmFsaWRhdGUuanNcIjtcblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgb3BlcmF0b3IgaXMgYW4gaW5jcmVtZW50IG9wZXJhdG9yXG5mdW5jdGlvbiBpc0luY3JlbWVudChvcCkge1xuXG4gICAgcmV0dXJuIG9wID09PSBcIisrXCIgfHwgb3AgPT09IFwiLS1cIjtcbn1cblxuLy8gUmV0dXJucyBhIGJpbmFyeSBvcGVyYXRvciBwcmVjZWRlbmNlIGxldmVsXG5mdW5jdGlvbiBnZXRQcmVjZWRlbmNlKG9wKSB7XG5cbiAgICBzd2l0Y2ggKG9wKSB7XG5cbiAgICAgICAgY2FzZSBcInx8XCI6IHJldHVybiAxO1xuICAgICAgICBjYXNlIFwiJiZcIjogcmV0dXJuIDI7XG4gICAgICAgIGNhc2UgXCJ8XCI6IHJldHVybiAzO1xuICAgICAgICBjYXNlIFwiXlwiOiByZXR1cm4gNDtcbiAgICAgICAgY2FzZSBcIiZcIjogcmV0dXJuIDU7XG4gICAgICAgIGNhc2UgXCI9PVwiOlxuICAgICAgICBjYXNlIFwiIT1cIjpcbiAgICAgICAgY2FzZSBcIj09PVwiOlxuICAgICAgICBjYXNlIFwiIT09XCI6IHJldHVybiA2O1xuICAgICAgICBjYXNlIFwiPD1cIjpcbiAgICAgICAgY2FzZSBcIj49XCI6XG4gICAgICAgIGNhc2UgXCI+XCI6XG4gICAgICAgIGNhc2UgXCI8XCI6XG4gICAgICAgIGNhc2UgXCJpbnN0YW5jZW9mXCI6XG4gICAgICAgIGNhc2UgXCJpblwiOiByZXR1cm4gNztcbiAgICAgICAgY2FzZSBcIj4+PlwiOlxuICAgICAgICBjYXNlIFwiPj5cIjpcbiAgICAgICAgY2FzZSBcIjw8XCI6IHJldHVybiA4O1xuICAgICAgICBjYXNlIFwiK1wiOlxuICAgICAgICBjYXNlIFwiLVwiOiByZXR1cm4gOTtcbiAgICAgICAgY2FzZSBcIipcIjpcbiAgICAgICAgY2FzZSBcIi9cIjpcbiAgICAgICAgY2FzZSBcIiVcIjogcmV0dXJuIDEwO1xuICAgIH1cblxuICAgIHJldHVybiAwO1xufVxuXG4vLyBSZXR1cm5zIHRydWUgaWYgdGhlIHNwZWNpZmllZCBvcGVyYXRvciBpcyBhbiBhc3NpZ25tZW50IG9wZXJhdG9yXG5mdW5jdGlvbiBpc0Fzc2lnbm1lbnQob3ApIHtcblxuICAgIGlmIChvcCA9PT0gXCI9XCIpXG4gICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgc3dpdGNoIChvcCkge1xuXG4gICAgICAgIGNhc2UgXCIqPVwiOlxuICAgICAgICBjYXNlIFwiJj1cIjpcbiAgICAgICAgY2FzZSBcIl49XCI6XG4gICAgICAgIGNhc2UgXCJ8PVwiOlxuICAgICAgICBjYXNlIFwiPDw9XCI6XG4gICAgICAgIGNhc2UgXCI+Pj1cIjpcbiAgICAgICAgY2FzZSBcIj4+Pj1cIjpcbiAgICAgICAgY2FzZSBcIiU9XCI6XG4gICAgICAgIGNhc2UgXCIrPVwiOlxuICAgICAgICBjYXNlIFwiLT1cIjpcbiAgICAgICAgY2FzZSBcIi89XCI6XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIG9wZXJhdG9yIGlzIGEgdW5hcnkgb3BlcmF0b3JcbmZ1bmN0aW9uIGlzVW5hcnkob3ApIHtcblxuICAgIHN3aXRjaCAob3ApIHtcblxuICAgICAgICBjYXNlIFwiYXdhaXRcIjpcbiAgICAgICAgY2FzZSBcImRlbGV0ZVwiOlxuICAgICAgICBjYXNlIFwidm9pZFwiOlxuICAgICAgICBjYXNlIFwidHlwZW9mXCI6XG4gICAgICAgIGNhc2UgXCIhXCI6XG4gICAgICAgIGNhc2UgXCJ+XCI6XG4gICAgICAgIGNhc2UgXCIrXCI6XG4gICAgICAgIGNhc2UgXCItXCI6XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiB0aGUgdmFsdWUgaXMgYSBmdW5jdGlvbiBtb2RpZmllciBrZXl3b3JkXG5mdW5jdGlvbiBpc0Z1bmN0aW9uTW9kaWZpZXIodmFsdWUpIHtcblxuICAgIHJldHVybiB2YWx1ZSA9PT0gXCJhc3luY1wiO1xufVxuXG4vLyBSZXR1cm5zIHRydWUgaWYgdGhlIHZhbHVlIGlzIGEgZ2VuZXJhdG9yIGZ1bmN0aW9uIG1vZGlmaWVyIGtleXdvcmRcbmZ1bmN0aW9uIGlzR2VuZXJhdG9yTW9kaWZpZXIodmFsdWUpIHtcblxuICAgIHJldHVybiB2YWx1ZSA9PT0gXCJhc3luY1wiIHx8IHZhbHVlID09PSBcIlwiO1xufVxuXG4vLyBSZXR1cm5zIHRydWUgaWYgdGhlIHZhbHVlIGlzIGEgbWV0aG9kIGRlZmluaXRpb24ga2V5d29yZFxuZnVuY3Rpb24gaXNNZXRob2RLZXl3b3JkKHZhbHVlKSB7XG5cbiAgICBzd2l0Y2ggKHZhbHVlKSB7XG5cbiAgICAgICAgY2FzZSBcImdldFwiOlxuICAgICAgICBjYXNlIFwic2V0XCI6XG4gICAgICAgIGNhc2UgXCJzdGF0aWNcIjpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBzdXBwbGllZCBtZXRhIHByb3BlcnR5IHBhaXIgaXMgdmFsaWRcbmZ1bmN0aW9uIGlzVmFsaWRNZXRhKGxlZnQsIHJpZ2h0KSB7XG5cbiAgICBzd2l0Y2ggKGxlZnQpIHtcblxuICAgICAgICBjYXNlIFwibmV3XCI6XG4gICAgICAgICAgICByZXR1cm4gcmlnaHQgPT09IFwidGFyZ2V0XCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBSZXR1cm5zIHRydWUgaWYgdGhlIHZhbHVlIGlzIGEga25vd24gZGlyZWN0aXZlXG5mdW5jdGlvbiBpc0RpcmVjdGl2ZSh2YWx1ZSkge1xuXG4gICAgcmV0dXJuIHZhbHVlID09PSBcInVzZSBzdHJpY3RcIjtcbn1cblxuLy8gUmV0dXJucyB0aGUgdmFsdWUgb2YgdGhlIHNwZWNpZmllZCB0b2tlbiwgaWYgaXQgaXMgYW4gaWRlbnRpZmllciBhbmQgZG9lcyBub3Rcbi8vIGNvbnRhaW4gYW55IHVuaWNvZGUgZXNjYXBlc1xuZnVuY3Rpb24ga2V5d29yZEZyb21Ub2tlbih0b2tlbikge1xuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiSURFTlRJRklFUlwiICYmIHRva2VuLmVuZCAtIHRva2VuLnN0YXJ0ID09PSB0b2tlbi52YWx1ZS5sZW5ndGgpXG4gICAgICAgIHJldHVybiB0b2tlbi52YWx1ZTtcblxuICAgIHJldHVybiBcIlwiO1xufVxuXG4vLyBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgc3BlY2lmaWVkIG5vZGUsIGlmIGl0IGlzIGFuIElkZW50aWZpZXIgYW5kIGRvZXMgbm90XG4vLyBjb250YWluIGFueSB1bmljb2RlIGVzY2FwZXNcbmZ1bmN0aW9uIGtleXdvcmRGcm9tTm9kZShub2RlKSB7XG5cbiAgICBpZiAobm9kZS50eXBlID09PSBcIklkZW50aWZpZXJcIiAmJiBub2RlLmVuZCAtIG5vZGUuc3RhcnQgPT09IG5vZGUudmFsdWUubGVuZ3RoKVxuICAgICAgICByZXR1cm4gbm9kZS52YWx1ZTtcblxuICAgIHJldHVybiBcIlwiO1xufVxuXG4vLyBDb3BpZXMgdG9rZW4gZGF0YVxuZnVuY3Rpb24gY29weVRva2VuKGZyb20sIHRvKSB7XG5cbiAgICB0by50eXBlID0gZnJvbS50eXBlO1xuICAgIHRvLnZhbHVlID0gZnJvbS52YWx1ZTtcbiAgICB0by5udW1iZXIgPSBmcm9tLm51bWJlcjtcbiAgICB0by5yZWdleEZsYWdzID0gZnJvbS5yZWdleEZsYWdzO1xuICAgIHRvLnRlbXBsYXRlRW5kID0gZnJvbS50ZW1wbGF0ZUVuZDtcbiAgICB0by5uZXdsaW5lQmVmb3JlID0gZnJvbS5uZXdsaW5lQmVmb3JlO1xuICAgIHRvLnN0cmljdEVycm9yID0gZnJvbS5zdHJpY3RFcnJvcjtcbiAgICB0by5zdGFydCA9IGZyb20uc3RhcnQ7XG4gICAgdG8uZW5kID0gZnJvbS5lbmQ7XG5cbiAgICByZXR1cm4gdG87XG59XG5cbmNsYXNzIENvbnRleHQge1xuXG4gICAgY29uc3RydWN0b3IocGFyZW50KSB7XG5cbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMubW9kZSA9IFwiXCI7XG4gICAgICAgIHRoaXMuaXNGdW5jdGlvbiA9IGZhbHNlO1xuICAgICAgICB0aGlzLmZ1bmN0aW9uQm9keSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmlzR2VuZXJhdG9yID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaXNBc3luYyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmlzTWV0aG9kID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaXNDb25zdHJ1Y3RvciA9IGZhbHNlO1xuICAgICAgICB0aGlzLmhhc1lpZWxkQXdhaXQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5sYWJlbE1hcCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3dpdGNoRGVwdGggPSAwO1xuICAgICAgICB0aGlzLmxvb3BEZXB0aCA9IDA7XG4gICAgICAgIHRoaXMuaW52YWxpZE5vZGVzID0gW107XG4gICAgfVxufVxuXG5jbGFzcyBQYXJzZVJlc3VsdCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbnB1dCwgbGluZU1hcCwgYXN0KSB7XG5cbiAgICAgICAgdGhpcy5pbnB1dCA9IGlucHV0O1xuICAgICAgICB0aGlzLmxpbmVNYXAgPSBsaW5lTWFwO1xuICAgICAgICB0aGlzLmFzdCA9IGFzdDtcbiAgICAgICAgdGhpcy5zY29wZVRyZWUgPSBudWxsO1xuICAgIH1cblxuICAgIGxvY2F0ZShvZmZzZXQpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5saW5lTWFwLmxvY2F0ZShvZmZzZXQpO1xuICAgIH1cblxuICAgIGNyZWF0ZVN5bnRheEVycm9yKG1lc3NhZ2UsIG5vZGUpIHtcblxuICAgICAgICBsZXQgbG9jID0gdGhpcy5saW5lTWFwLmxvY2F0ZShub2RlLnN0YXJ0KSxcbiAgICAgICAgICAgIGVyciA9IG5ldyBTeW50YXhFcnJvcihtZXNzYWdlKTtcblxuICAgICAgICBlcnIubGluZSA9IGxvYy5saW5lO1xuICAgICAgICBlcnIuY29sdW1uID0gbG9jLmNvbHVtbjtcbiAgICAgICAgZXJyLmxpbmVPZmZzZXQgPSBsb2MubGluZU9mZnNldDtcbiAgICAgICAgZXJyLnN0YXJ0T2Zmc2V0ID0gbm9kZS5zdGFydDtcbiAgICAgICAgZXJyLmVuZE9mZnNldCA9IG5vZGUuZW5kO1xuICAgICAgICBlcnIuc291cmNlVGV4dCA9IHRoaXMuaW5wdXQ7XG5cbiAgICAgICAgcmV0dXJuIGVycjtcbiAgICB9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG5cbiAgICBwYXJzZShpbnB1dCwgb3B0aW9ucykge1xuXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICAgIGxldCBzY2FubmVyID0gbmV3IFNjYW5uZXIoaW5wdXQpO1xuXG4gICAgICAgIHRoaXMuc2Nhbm5lciA9IHNjYW5uZXI7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBpbnB1dDtcblxuICAgICAgICB0aGlzLnBlZWswID0gbnVsbDtcbiAgICAgICAgdGhpcy5wZWVrMSA9IG51bGw7XG4gICAgICAgIHRoaXMudG9rZW5TdGFzaCA9IG5ldyBTY2FubmVyO1xuICAgICAgICB0aGlzLnRva2VuRW5kID0gc2Nhbm5lci5vZmZzZXQ7XG5cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gbmV3IENvbnRleHQobnVsbCwgZmFsc2UpO1xuICAgICAgICB0aGlzLnNldFN0cmljdChmYWxzZSk7XG5cbiAgICAgICAgbGV0IGFzdCA9IG9wdGlvbnMubW9kdWxlID8gdGhpcy5Nb2R1bGUoKSA6IHRoaXMuU2NyaXB0KCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQYXJzZVJlc3VsdCh0aGlzLmlucHV0LCB0aGlzLnNjYW5uZXIubGluZU1hcCwgYXN0KTtcbiAgICB9XG5cbiAgICBuZXh0VG9rZW4oY29udGV4dCkge1xuXG4gICAgICAgIGxldCBzY2FubmVyID0gdGhpcy5zY2FubmVyLFxuICAgICAgICAgICAgdHlwZSA9IFwiXCI7XG5cbiAgICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwgXCJcIjtcblxuICAgICAgICBkbyB7IHR5cGUgPSBzY2FubmVyLm5leHQoY29udGV4dCk7IH1cbiAgICAgICAgd2hpbGUgKHR5cGUgPT09IFwiQ09NTUVOVFwiKVxuXG4gICAgICAgIHJldHVybiBzY2FubmVyO1xuICAgIH1cblxuICAgIG5vZGVTdGFydCgpIHtcblxuICAgICAgICBpZiAodGhpcy5wZWVrMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBlZWswLnN0YXJ0O1xuXG4gICAgICAgIC8vIFNraXAgb3ZlciB3aGl0ZXNwYWNlIGFuZCBjb21tZW50c1xuICAgICAgICB0aGlzLnNjYW5uZXIuc2tpcCgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5uZXIub2Zmc2V0O1xuICAgIH1cblxuICAgIG5vZGVFbmQoKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMudG9rZW5FbmQ7XG4gICAgfVxuXG4gICAgcmVhZFRva2VuKHR5cGUsIGNvbnRleHQpIHtcblxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWswIHx8IHRoaXMubmV4dFRva2VuKGNvbnRleHQpO1xuXG4gICAgICAgIHRoaXMucGVlazAgPSB0aGlzLnBlZWsxO1xuICAgICAgICB0aGlzLnBlZWsxID0gbnVsbDtcbiAgICAgICAgdGhpcy50b2tlbkVuZCA9IHRva2VuLmVuZDtcblxuICAgICAgICBpZiAodHlwZSAmJiB0b2tlbi50eXBlICE9PSB0eXBlKVxuICAgICAgICAgICAgdGhpcy51bmV4cGVjdGVkKHRva2VuKTtcblxuICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgfVxuXG4gICAgcmVhZCh0eXBlLCBjb250ZXh0KSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuKHR5cGUsIGNvbnRleHQpLnR5cGU7XG4gICAgfVxuXG4gICAgcGVla1Rva2VuKGNvbnRleHQpIHtcblxuICAgICAgICBpZiAoIXRoaXMucGVlazApXG4gICAgICAgICAgICB0aGlzLnBlZWswID0gdGhpcy5uZXh0VG9rZW4oY29udGV4dCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucGVlazA7XG4gICAgfVxuXG4gICAgcGVlayhjb250ZXh0KSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucGVla1Rva2VuKGNvbnRleHQpLnR5cGU7XG4gICAgfVxuXG4gICAgcGVla1Rva2VuQXQoY29udGV4dCwgaW5kZXgpIHtcblxuICAgICAgICBpZiAoaW5kZXggIT09IDEgfHwgdGhpcy5wZWVrMCA9PT0gbnVsbClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgbG9va2FoZWFkXCIpXG5cbiAgICAgICAgaWYgKHRoaXMucGVlazEgPT09IG51bGwpIHtcblxuICAgICAgICAgICAgdGhpcy5wZWVrMCA9IGNvcHlUb2tlbih0aGlzLnBlZWswLCB0aGlzLnRva2VuU3Rhc2gpO1xuICAgICAgICAgICAgdGhpcy5wZWVrMSA9IHRoaXMubmV4dFRva2VuKGNvbnRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucGVlazE7XG4gICAgfVxuXG4gICAgcGVla0F0KGNvbnRleHQsIGluZGV4KSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucGVla1Rva2VuQXQoY29udGV4dCwgaW5kZXgpLnR5cGU7XG4gICAgfVxuXG4gICAgdW5wZWVrKCkge1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWswKSB7XG5cbiAgICAgICAgICAgIHRoaXMuc2Nhbm5lci5vZmZzZXQgPSB0aGlzLnBlZWswLnN0YXJ0O1xuICAgICAgICAgICAgdGhpcy5wZWVrMCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnBlZWsxID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBlZWtVbnRpbCh0eXBlLCBjb250ZXh0KSB7XG5cbiAgICAgICAgbGV0IHRvayA9IHRoaXMucGVlayhjb250ZXh0KTtcbiAgICAgICAgcmV0dXJuIHRvayAhPT0gXCJFT0ZcIiAmJiB0b2sgIT09IHR5cGUgPyB0b2sgOiBudWxsO1xuICAgIH1cblxuICAgIHJlYWRLZXl3b3JkKHdvcmQpIHtcblxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnJlYWRUb2tlbigpO1xuXG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSB3b3JkIHx8IGtleXdvcmRGcm9tVG9rZW4odG9rZW4pID09PSB3b3JkKVxuICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuXG4gICAgICAgIHRoaXMudW5leHBlY3RlZCh0b2tlbik7XG4gICAgfVxuXG4gICAgcGVla0tleXdvcmQod29yZCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVla1Rva2VuKCk7XG4gICAgICAgIHJldHVybiB0b2tlbi50eXBlID09PSB3b3JkIHx8IGtleXdvcmRGcm9tVG9rZW4odG9rZW4pID09PSB3b3JkO1xuICAgIH1cblxuICAgIHBlZWtMZXQoKSB7XG5cbiAgICAgICAgaWYgKHRoaXMucGVla0tleXdvcmQoXCJsZXRcIikpIHtcblxuICAgICAgICAgICAgc3dpdGNoICh0aGlzLnBlZWtBdChcImRpdlwiLCAxKSkge1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIntcIjpcbiAgICAgICAgICAgICAgICBjYXNlIFwiW1wiOlxuICAgICAgICAgICAgICAgIGNhc2UgXCJJREVOVElGSUVSXCI6IHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHBlZWtZaWVsZCgpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5jb250ZXh0LmZ1bmN0aW9uQm9keSAmJlxuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmlzR2VuZXJhdG9yICYmXG4gICAgICAgICAgICB0aGlzLnBlZWtLZXl3b3JkKFwieWllbGRcIik7XG4gICAgfVxuXG4gICAgcGVla0F3YWl0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWtLZXl3b3JkKFwiYXdhaXRcIikpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY29udGV4dC5mdW5jdGlvbkJvZHkgJiYgdGhpcy5jb250ZXh0LmlzQXN5bmMpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzTW9kdWxlKVxuICAgICAgICAgICAgICAgIHRoaXMuZmFpbChcIkF3YWl0IGlzIHJlc2VydmVkIHdpdGhpbiBtb2R1bGVzXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHBlZWtGdW5jdGlvbk1vZGlmaWVyKCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVla1Rva2VuKCk7XG5cbiAgICAgICAgaWYgKCFpc0Z1bmN0aW9uTW9kaWZpZXIoa2V5d29yZEZyb21Ub2tlbih0b2tlbikpKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHRva2VuID0gdGhpcy5wZWVrVG9rZW5BdChcImRpdlwiLCAxKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLnR5cGUgPT09IFwiZnVuY3Rpb25cIiAmJiAhdG9rZW4ubmV3bGluZUJlZm9yZTtcbiAgICB9XG5cbiAgICBwZWVrRW5kKCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVla1Rva2VuKCk7XG5cbiAgICAgICAgaWYgKCF0b2tlbi5uZXdsaW5lQmVmb3JlKSB7XG5cbiAgICAgICAgICAgIHN3aXRjaCAodG9rZW4udHlwZSkge1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIkVPRlwiOlxuICAgICAgICAgICAgICAgIGNhc2UgXCJ9XCI6XG4gICAgICAgICAgICAgICAgY2FzZSBcIjtcIjpcbiAgICAgICAgICAgICAgICBjYXNlIFwiKVwiOlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHVuZXhwZWN0ZWQodG9rZW4pIHtcblxuICAgICAgICBsZXQgdHlwZSA9IHRva2VuLnR5cGUsIG1zZztcblxuICAgICAgICBtc2cgPSB0eXBlID09PSBcIkVPRlwiID9cbiAgICAgICAgICAgIFwiVW5leHBlY3RlZCBlbmQgb2YgaW5wdXRcIiA6XG4gICAgICAgICAgICBcIlVuZXhwZWN0ZWQgdG9rZW4gXCIgKyB0b2tlbi50eXBlO1xuXG4gICAgICAgIHRoaXMuZmFpbChtc2csIHRva2VuKTtcbiAgICB9XG5cbiAgICBmYWlsKG1zZywgbm9kZSkge1xuXG4gICAgICAgIGlmICghbm9kZSlcbiAgICAgICAgICAgIG5vZGUgPSB0aGlzLnBlZWtUb2tlbigpO1xuXG4gICAgICAgIGxldCByZXN1bHQgPSBuZXcgUGFyc2VSZXN1bHQodGhpcy5pbnB1dCwgdGhpcy5zY2FubmVyLmxpbmVNYXAsIG51bGwpO1xuICAgICAgICB0aHJvdyByZXN1bHQuY3JlYXRlU3ludGF4RXJyb3IobXNnLCBub2RlKTtcbiAgICB9XG5cbiAgICB1bndyYXBQYXJlbnMobm9kZSkge1xuXG4gICAgICAgIC8vIFJlbW92ZSBhbnkgcGFyZW50aGVzaXMgc3Vycm91bmRpbmcgdGhlIHRhcmdldFxuICAgICAgICBmb3IgKDsgbm9kZS50eXBlID09PSBcIlBhcmVuRXhwcmVzc2lvblwiOyBub2RlID0gbm9kZS5leHByZXNzaW9uKTtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG5cbiAgICAvLyA9PSBDb250ZXh0IE1hbmFnZW1lbnQgPT1cblxuICAgIHB1c2hDb250ZXh0KGlzQXJyb3cpIHtcblxuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcy5jb250ZXh0LFxuICAgICAgICAgICAgYyA9IG5ldyBDb250ZXh0KHBhcmVudCk7XG5cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gYztcblxuICAgICAgICBpZiAocGFyZW50Lm1vZGUgPT09IFwic3RyaWN0XCIpXG4gICAgICAgICAgICBjLm1vZGUgPSBcInN0cmljdFwiO1xuXG4gICAgICAgIGlmIChpc0Fycm93KSB7XG5cbiAgICAgICAgICAgIGMuaXNNZXRob2QgPSBwYXJlbnQuaXNNZXRob2Q7XG4gICAgICAgICAgICBjLmlzQ29uc3RydWN0b3IgPSBwYXJlbnQuaXNDb25zdHJ1Y3RvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjO1xuICAgIH1cblxuICAgIHB1c2hNYXliZUNvbnRleHQoKSB7XG5cbiAgICAgICAgbGV0IHBhcmVudCA9IHRoaXMuY29udGV4dCxcbiAgICAgICAgICAgIGMgPSB0aGlzLnB1c2hDb250ZXh0KCk7XG5cbiAgICAgICAgYy5pc0Z1bmN0aW9uID0gcGFyZW50LmlzRnVuY3Rpb247XG4gICAgICAgIGMuaXNHZW5lcmF0b3IgPSBwYXJlbnQuaXNHZW5lcmF0b3I7XG4gICAgICAgIGMuaXNBc3luYyA9IHBhcmVudC5pc0FzeW5jO1xuICAgICAgICBjLmlzTWV0aG9kID0gcGFyZW50LmlzTWV0aG9kO1xuICAgICAgICBjLmlzQ29uc3RydWN0b3IgPSBwYXJlbnQuaXNDb25zdHJ1Y3RvcjtcbiAgICAgICAgYy5mdW5jdGlvbkJvZHkgPSBwYXJlbnQuZnVuY3Rpb25Cb2R5O1xuICAgIH1cblxuICAgIHBvcENvbnRleHQoY29sbGFwc2UpIHtcblxuICAgICAgICBsZXQgY29udGV4dCA9IHRoaXMuY29udGV4dCxcbiAgICAgICAgICAgIHBhcmVudCA9IGNvbnRleHQucGFyZW50O1xuXG4gICAgICAgIC8vIElmIGNvbGxhcHNpbmcgaW50byBwYXJlbnQgY29udGV4dCwgY29weSBpbnZhbGlkIG5vZGVzIGludG8gcGFyZW50XG4gICAgICAgIGlmIChjb2xsYXBzZSlcbiAgICAgICAgICAgIGNvbnRleHQuaW52YWxpZE5vZGVzLmZvckVhY2gobm9kZSA9PiBwYXJlbnQuaW52YWxpZE5vZGVzLnB1c2gobm9kZSkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLmNoZWNrSW52YWxpZE5vZGVzKCk7XG5cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gdGhpcy5jb250ZXh0LnBhcmVudDtcbiAgICB9XG5cbiAgICBzZXRTdHJpY3Qoc3RyaWN0KSB7XG5cbiAgICAgICAgdGhpcy5jb250ZXh0Lm1vZGUgPSBzdHJpY3QgPyBcInN0cmljdFwiIDogXCJzbG9wcHlcIjtcbiAgICB9XG5cbiAgICBhZGRTdHJpY3RFcnJvcihlcnJvciwgbm9kZSkge1xuXG4gICAgICAgIHRoaXMuYWRkSW52YWxpZE5vZGUoZXJyb3IsIG5vZGUsIHRydWUpO1xuICAgIH1cblxuICAgIGFkZEludmFsaWROb2RlKGVycm9yLCBub2RlLCBzdHJpY3QpIHtcblxuICAgICAgICBub2RlLmVycm9yID0gZXJyb3I7XG4gICAgICAgIHRoaXMuY29udGV4dC5pbnZhbGlkTm9kZXMucHVzaCh7IG5vZGUsIHN0cmljdDogISFzdHJpY3QgfSk7XG4gICAgfVxuXG4gICAgc2V0TGFiZWwobGFiZWwsIHZhbHVlKSB7XG5cbiAgICAgICAgbGV0IG0gPSB0aGlzLmNvbnRleHQubGFiZWxNYXA7XG5cbiAgICAgICAgaWYgKCFtKVxuICAgICAgICAgICAgbSA9IHRoaXMuY29udGV4dC5sYWJlbE1hcCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAgICAgbVtsYWJlbF0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXRMYWJlbChsYWJlbCkge1xuXG4gICAgICAgIGxldCBtID0gdGhpcy5jb250ZXh0LmxhYmVsTWFwO1xuICAgICAgICByZXR1cm4gKG0gJiYgbVtsYWJlbF0pIHwgMDtcbiAgICB9XG5cbiAgICBzZXRGdW5jdGlvblR5cGUoa2luZCkge1xuXG4gICAgICAgIGxldCBjID0gdGhpcy5jb250ZXh0LFxuICAgICAgICAgICAgYSA9IGZhbHNlLFxuICAgICAgICAgICAgZyA9IGZhbHNlO1xuXG4gICAgICAgIHN3aXRjaCAoa2luZCkge1xuXG4gICAgICAgICAgICBjYXNlIFwiYXN5bmNcIjogYSA9IHRydWU7IGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImdlbmVyYXRvclwiOiBnID0gdHJ1ZTsgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiYXN5bmMtZ2VuZXJhdG9yXCI6IGEgPSBnID0gdHJ1ZTsgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBjLmlzRnVuY3Rpb24gPSB0cnVlO1xuICAgICAgICBjLmlzQXN5bmMgPSBhO1xuICAgICAgICBjLmlzR2VuZXJhdG9yID0gZztcbiAgICB9XG5cbiAgICAvLyA9PT0gVG9wIExldmVsID09PVxuXG4gICAgU2NyaXB0KCkge1xuXG4gICAgICAgIHRoaXMuaXNNb2R1bGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5wdXNoQ29udGV4dCgpO1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBzdGF0ZW1lbnRzID0gdGhpcy5TdGF0ZW1lbnRMaXN0KHRydWUsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLnBvcENvbnRleHQoKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5TY3JpcHQoc3RhdGVtZW50cywgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBNb2R1bGUoKSB7XG5cbiAgICAgICAgdGhpcy5pc01vZHVsZSA9IHRydWU7XG4gICAgICAgIHRoaXMucHVzaENvbnRleHQoKTtcbiAgICAgICAgdGhpcy5zZXRTdHJpY3QodHJ1ZSk7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIHN0YXRlbWVudHMgPSB0aGlzLlN0YXRlbWVudExpc3QodHJ1ZSwgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5wb3BDb250ZXh0KCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuTW9kdWxlKHN0YXRlbWVudHMsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgLy8gPT09IEV4cHJlc3Npb25zID09PVxuXG4gICAgRXhwcmVzc2lvbihub0luKSB7XG5cbiAgICAgICAgbGV0IGV4cHIgPSB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKG5vSW4pLFxuICAgICAgICAgICAgbGlzdCA9IG51bGw7XG5cbiAgICAgICAgd2hpbGUgKHRoaXMucGVlayhcImRpdlwiKSA9PT0gXCIsXCIpIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG5cbiAgICAgICAgICAgIGlmIChsaXN0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGV4cHIgPSBuZXcgQVNULlNlcXVlbmNlRXhwcmVzc2lvbihsaXN0ID0gW2V4cHJdLCBleHByLnN0YXJ0LCAtMSk7XG5cbiAgICAgICAgICAgIGxpc3QucHVzaCh0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKG5vSW4pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsaXN0KVxuICAgICAgICAgICAgZXhwci5lbmQgPSB0aGlzLm5vZGVFbmQoKTtcblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICBBc3NpZ25tZW50RXhwcmVzc2lvbihub0luLCBhbGxvd1NwcmVhZCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBub2RlO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsoKSA9PT0gXCIuLi5cIikge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoKTtcblxuICAgICAgICAgICAgbm9kZSA9IG5ldyBBU1QuU3ByZWFkRXhwcmVzc2lvbihcbiAgICAgICAgICAgICAgICB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKG5vSW4pLFxuICAgICAgICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcblxuICAgICAgICAgICAgaWYgKCFhbGxvd1NwcmVhZClcbiAgICAgICAgICAgICAgICB0aGlzLmFkZEludmFsaWROb2RlKFwiSW52YWxpZCBzcHJlYWQgZXhwcmVzc2lvblwiLCBub2RlKTtcblxuICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wZWVrWWllbGQoKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLllpZWxkRXhwcmVzc2lvbihub0luKTtcblxuICAgICAgICBub2RlID0gdGhpcy5Db25kaXRpb25hbEV4cHJlc3Npb24obm9Jbik7XG5cbiAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gXCJBcnJvd0Z1bmN0aW9uSGVhZFwiKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuQXJyb3dGdW5jdGlvbkJvZHkobm9kZSwgbm9Jbik7XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIGFzc2lnbm1lbnQgb3BlcmF0b3JcbiAgICAgICAgaWYgKCFpc0Fzc2lnbm1lbnQodGhpcy5wZWVrKFwiZGl2XCIpKSlcbiAgICAgICAgICAgIHJldHVybiBub2RlO1xuXG4gICAgICAgIHRoaXMuY2hlY2tBc3NpZ25tZW50VGFyZ2V0KHRoaXMudW53cmFwUGFyZW5zKG5vZGUpLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuQXNzaWdubWVudEV4cHJlc3Npb24oXG4gICAgICAgICAgICB0aGlzLnJlYWQoKSxcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKG5vSW4pLFxuICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgWWllbGRFeHByZXNzaW9uKG5vSW4pIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgZGVsZWdhdGUgPSBmYWxzZSxcbiAgICAgICAgICAgIGV4cHIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVhZEtleXdvcmQoXCJ5aWVsZFwiKTtcblxuICAgICAgICBpZiAoIXRoaXMucGVla0VuZCgpICYmIHRoaXMucGVlaygpICE9PSBcIixcIikge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5wZWVrKCkgPT09IFwiKlwiKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgICAgICBkZWxlZ2F0ZSA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGV4cHIgPSB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKG5vSW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb250ZXh0Lmhhc1lpZWxkQXdhaXQgPSB0cnVlO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULllpZWxkRXhwcmVzc2lvbihcbiAgICAgICAgICAgIGV4cHIsXG4gICAgICAgICAgICBkZWxlZ2F0ZSxcbiAgICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgICAgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIENvbmRpdGlvbmFsRXhwcmVzc2lvbihub0luKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGxlZnQgPSB0aGlzLkJpbmFyeUV4cHJlc3Npb24obm9JbiksXG4gICAgICAgICAgICBtaWRkbGUsXG4gICAgICAgICAgICByaWdodDtcblxuICAgICAgICBpZiAodGhpcy5wZWVrKFwiZGl2XCIpICE9PSBcIj9cIilcbiAgICAgICAgICAgIHJldHVybiBsZWZ0O1xuXG4gICAgICAgIHRoaXMucmVhZChcIj9cIik7XG4gICAgICAgIG1pZGRsZSA9IHRoaXMuQXNzaWdubWVudEV4cHJlc3Npb24oKTtcbiAgICAgICAgdGhpcy5yZWFkKFwiOlwiKTtcbiAgICAgICAgcmlnaHQgPSB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKG5vSW4pO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkNvbmRpdGlvbmFsRXhwcmVzc2lvbihsZWZ0LCBtaWRkbGUsIHJpZ2h0LCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIEJpbmFyeUV4cHJlc3Npb24obm9Jbikge1xuXG4gICAgICAgIHJldHVybiB0aGlzLlBhcnRpYWxCaW5hcnlFeHByZXNzaW9uKHRoaXMuVW5hcnlFeHByZXNzaW9uKCksIDAsIG5vSW4pO1xuICAgIH1cblxuICAgIFBhcnRpYWxCaW5hcnlFeHByZXNzaW9uKGxocywgbWluUHJlYywgbm9Jbikge1xuXG4gICAgICAgIGxldCBwcmVjID0gMCxcbiAgICAgICAgICAgIG5leHQgPSBcIlwiLFxuICAgICAgICAgICAgbWF4ID0gMCxcbiAgICAgICAgICAgIG9wID0gXCJcIixcbiAgICAgICAgICAgIHJocztcblxuICAgICAgICB3aGlsZSAobmV4dCA9IHRoaXMucGVlayhcImRpdlwiKSkge1xuXG4gICAgICAgICAgICAvLyBFeGl0IGlmIG9wZXJhdG9yIGlzIFwiaW5cIiBhbmQgaW4gaXMgbm90IGFsbG93ZWRcbiAgICAgICAgICAgIGlmIChuZXh0ID09PSBcImluXCIgJiYgbm9JbilcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgcHJlYyA9IGdldFByZWNlZGVuY2UobmV4dCk7XG5cbiAgICAgICAgICAgIC8vIEV4aXQgaWYgbm90IGEgYmluYXJ5IG9wZXJhdG9yIG9yIGxvd2VyIHByZWNlbmRlbmNlXG4gICAgICAgICAgICBpZiAocHJlYyA9PT0gMCB8fCBwcmVjIDwgbWluUHJlYylcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG5cbiAgICAgICAgICAgIG9wID0gbmV4dDtcbiAgICAgICAgICAgIG1heCA9IHByZWM7XG4gICAgICAgICAgICByaHMgPSB0aGlzLlVuYXJ5RXhwcmVzc2lvbigpO1xuXG4gICAgICAgICAgICB3aGlsZSAobmV4dCA9IHRoaXMucGVlayhcImRpdlwiKSkge1xuXG4gICAgICAgICAgICAgICAgcHJlYyA9IGdldFByZWNlZGVuY2UobmV4dCk7XG5cbiAgICAgICAgICAgICAgICAvLyBFeGl0IGlmIG5vdCBhIGJpbmFyeSBvcGVyYXRvciBvciBlcXVhbCBvciBoaWdoZXIgcHJlY2VuZGVuY2VcbiAgICAgICAgICAgICAgICBpZiAocHJlYyA9PT0gMCB8fCBwcmVjIDw9IG1heClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICByaHMgPSB0aGlzLlBhcnRpYWxCaW5hcnlFeHByZXNzaW9uKHJocywgcHJlYywgbm9Jbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxocyA9IG5ldyBBU1QuQmluYXJ5RXhwcmVzc2lvbihvcCwgbGhzLCByaHMsIGxocy5zdGFydCwgcmhzLmVuZCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGhzO1xuICAgIH1cblxuICAgIFVuYXJ5RXhwcmVzc2lvbigpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgdHlwZSA9IHRoaXMucGVlaygpLFxuICAgICAgICAgICAgdG9rZW4sXG4gICAgICAgICAgICBleHByO1xuXG4gICAgICAgIGlmIChpc0luY3JlbWVudCh0eXBlKSkge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIGV4cHIgPSB0aGlzLk1lbWJlckV4cHJlc3Npb24odHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmNoZWNrQXNzaWdubWVudFRhcmdldCh0aGlzLnVud3JhcFBhcmVucyhleHByKSwgdHJ1ZSk7XG5cbiAgICAgICAgICAgIHJldHVybiBuZXcgQVNULlVwZGF0ZUV4cHJlc3Npb24odHlwZSwgZXhwciwgdHJ1ZSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnBlZWtBd2FpdCgpKSB7XG5cbiAgICAgICAgICAgIHR5cGUgPSBcImF3YWl0XCI7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQuaGFzWWllbGRBd2FpdCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNVbmFyeSh0eXBlKSkge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIGV4cHIgPSB0aGlzLlVuYXJ5RXhwcmVzc2lvbigpO1xuXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gXCJkZWxldGVcIilcbiAgICAgICAgICAgICAgICB0aGlzLmNoZWNrRGVsZXRlKGV4cHIpO1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3IEFTVC5VbmFyeUV4cHJlc3Npb24odHlwZSwgZXhwciwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cHIgPSB0aGlzLk1lbWJlckV4cHJlc3Npb24odHJ1ZSk7XG4gICAgICAgIHRva2VuID0gdGhpcy5wZWVrVG9rZW4oXCJkaXZcIik7XG4gICAgICAgIHR5cGUgPSB0b2tlbi50eXBlO1xuXG4gICAgICAgIC8vIENoZWNrIGZvciBwb3N0Zml4IG9wZXJhdG9yXG4gICAgICAgIGlmIChpc0luY3JlbWVudCh0eXBlKSAmJiAhdG9rZW4ubmV3bGluZUJlZm9yZSkge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tBc3NpZ25tZW50VGFyZ2V0KHRoaXMudW53cmFwUGFyZW5zKGV4cHIpLCB0cnVlKTtcblxuICAgICAgICAgICAgcmV0dXJuIG5ldyBBU1QuVXBkYXRlRXhwcmVzc2lvbih0eXBlLCBleHByLCBmYWxzZSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIE1lbWJlckV4cHJlc3Npb24oYWxsb3dDYWxsKSB7XG5cbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5wZWVrVG9rZW4oKSxcbiAgICAgICAgICAgIHN0YXJ0ID0gdG9rZW4uc3RhcnQsXG4gICAgICAgICAgICBhcnJvd1R5cGUgPSBcIlwiLFxuICAgICAgICAgICAgaXNTdXBlciA9IGZhbHNlLFxuICAgICAgICAgICAgZXhpdCA9IGZhbHNlLFxuICAgICAgICAgICAgZXhwcixcbiAgICAgICAgICAgIHByb3A7XG5cbiAgICAgICAgc3dpdGNoICh0b2tlbi50eXBlKSB7XG5cbiAgICAgICAgICAgIGNhc2UgXCJzdXBlclwiOlxuXG4gICAgICAgICAgICAgICAgZXhwciA9IHRoaXMuU3VwZXJLZXl3b3JkKCk7XG4gICAgICAgICAgICAgICAgaXNTdXBlciA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJuZXdcIjpcblxuICAgICAgICAgICAgICAgIGV4cHIgPSB0aGlzLnBlZWtBdChcIlwiLCAxKSA9PT0gXCIuXCIgP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLk1ldGFQcm9wZXJ0eSgpIDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5OZXdFeHByZXNzaW9uKCk7XG5cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcIjo6XCI6XG5cbiAgICAgICAgICAgICAgICBpZiAoYWxsb3dDYWxsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgZXhwciA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmYXVsdDpcblxuICAgICAgICAgICAgICAgIGV4cHIgPSB0aGlzLlByaW1hcnlFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoIWV4aXQpIHtcblxuICAgICAgICAgICAgdG9rZW4gPSB0aGlzLnBlZWtUb2tlbihcImRpdlwiKTtcblxuICAgICAgICAgICAgc3dpdGNoICh0b2tlbi50eXBlKSB7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiLlwiOlxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHByb3AgPSB0aGlzLnBlZWsoXCJuYW1lXCIpID09PSBcIkFUTkFNRVwiICYmICFpc1N1cGVyID9cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuQXROYW1lKCkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5JZGVudGlmaWVyTmFtZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGV4cHIgPSBuZXcgQVNULk1lbWJlckV4cHJlc3Npb24oXG4gICAgICAgICAgICAgICAgICAgICAgICBleHByLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiW1wiOlxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgICAgICAgICBwcm9wID0gdGhpcy5FeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZChcIl1cIik7XG5cbiAgICAgICAgICAgICAgICAgICAgZXhwciA9IG5ldyBBU1QuTWVtYmVyRXhwcmVzc2lvbihcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cHIsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ub2RlRW5kKCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIihcIjpcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNTdXBlcikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWFsbG93Q2FsbCB8fCAhdGhpcy5jb250ZXh0LmlzQ29uc3RydWN0b3IpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mYWlsKFwiSW52YWxpZCBzdXBlciBjYWxsXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhbGxvd0NhbGwpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZXhpdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uTW9kaWZpZXIoa2V5d29yZEZyb21Ob2RlKGV4cHIpKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJvd1R5cGUgPSBleHByLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wdXNoTWF5YmVDb250ZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBleHByID0gbmV3IEFTVC5DYWxsRXhwcmVzc2lvbihcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cHIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLkFyZ3VtZW50TGlzdCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGFycm93VHlwZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0b2tlbiA9IHRoaXMucGVla1Rva2VuKFwiZGl2XCIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodG9rZW4udHlwZSA9PT0gXCI9PlwiICYmICF0b2tlbi5uZXdsaW5lQmVmb3JlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHByID0gdGhpcy5BcnJvd0Z1bmN0aW9uSGVhZChhcnJvd1R5cGUsIGV4cHIsIHN0YXJ0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGl0ID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycm93VHlwZSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3BDb250ZXh0KHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiVEVNUExBVEVcIjpcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNTdXBlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGV4cHIgPSBuZXcgQVNULlRhZ2dlZFRlbXBsYXRlRXhwcmVzc2lvbihcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cHIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLlRlbXBsYXRlRXhwcmVzc2lvbigpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiOjpcIjpcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNTdXBlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghYWxsb3dDYWxsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlYWQoKTtcblxuICAgICAgICAgICAgICAgICAgICBleHByID0gbmV3IEFTVC5CaW5kRXhwcmVzc2lvbihcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cHIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLk1lbWJlckV4cHJlc3Npb24oZmFsc2UpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1N1cGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mYWlsKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgZXhpdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpc1N1cGVyID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICBOZXdFeHByZXNzaW9uKCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwibmV3XCIpO1xuXG4gICAgICAgIGxldCBleHByID0gdGhpcy5NZW1iZXJFeHByZXNzaW9uKGZhbHNlKSxcbiAgICAgICAgICAgIGFyZ3MgPSB0aGlzLnBlZWsoXCJkaXZcIikgPT09IFwiKFwiID8gdGhpcy5Bcmd1bWVudExpc3QoKSA6IG51bGw7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuTmV3RXhwcmVzc2lvbihleHByLCBhcmdzLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIE1ldGFQcm9wZXJ0eSgpIHtcblxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnJlYWRUb2tlbigpLFxuICAgICAgICAgICAgc3RhcnQgPSB0b2tlbi5zdGFydCxcbiAgICAgICAgICAgIGxlZnQgPSB0b2tlbi50eXBlID09PSBcIklERU5USUZJRVJcIiA/IHRva2VuLnZhbHVlIDogdG9rZW4udHlwZSxcbiAgICAgICAgICAgIHJpZ2h0O1xuXG4gICAgICAgIHRoaXMucmVhZChcIi5cIik7XG5cbiAgICAgICAgdG9rZW4gPSB0aGlzLnJlYWRUb2tlbihcIklERU5USUZJRVJcIiwgXCJuYW1lXCIpO1xuICAgICAgICByaWdodCA9IHRva2VuLnZhbHVlO1xuXG4gICAgICAgIGlmICghaXNWYWxpZE1ldGEobGVmdCwgcmlnaHQpKVxuICAgICAgICAgICAgdGhpcy5mYWlsKFwiSW52YWxpZCBtZXRhIHByb3BlcnR5XCIsIHRva2VuKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5NZXRhUHJvcGVydHkobGVmdCwgcmlnaHQsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgU3VwZXJLZXl3b3JkKCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucmVhZFRva2VuKFwic3VwZXJcIiksXG4gICAgICAgICAgICBub2RlID0gbmV3IEFTVC5TdXBlcktleXdvcmQodG9rZW4uc3RhcnQsIHRva2VuLmVuZCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmNvbnRleHQuaXNNZXRob2QpXG4gICAgICAgICAgICB0aGlzLmZhaWwoXCJTdXBlciBrZXl3b3JkIG91dHNpZGUgb2YgbWV0aG9kXCIsIG5vZGUpO1xuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIEFyZ3VtZW50TGlzdCgpIHtcblxuICAgICAgICBsZXQgbGlzdCA9IFtdO1xuXG4gICAgICAgIHRoaXMucmVhZChcIihcIik7XG5cbiAgICAgICAgd2hpbGUgKHRoaXMucGVla1VudGlsKFwiKVwiKSkge1xuXG4gICAgICAgICAgICBpZiAobGlzdC5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIHRoaXMucmVhZChcIixcIik7XG5cbiAgICAgICAgICAgIGxpc3QucHVzaCh0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKGZhbHNlLCB0cnVlKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlYWQoXCIpXCIpO1xuXG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgIH1cblxuICAgIFByaW1hcnlFeHByZXNzaW9uKCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVla1Rva2VuKCksXG4gICAgICAgICAgICB0eXBlID0gdG9rZW4udHlwZSxcbiAgICAgICAgICAgIHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIG5leHQsXG4gICAgICAgICAgICB2YWx1ZTtcblxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcblxuICAgICAgICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiB0aGlzLkZ1bmN0aW9uRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgY2FzZSBcImNsYXNzXCI6IHJldHVybiB0aGlzLkNsYXNzRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgY2FzZSBcIlRFTVBMQVRFXCI6IHJldHVybiB0aGlzLlRlbXBsYXRlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgY2FzZSBcIk5VTUJFUlwiOiByZXR1cm4gdGhpcy5OdW1iZXJMaXRlcmFsKCk7XG4gICAgICAgICAgICBjYXNlIFwiU1RSSU5HXCI6IHJldHVybiB0aGlzLlN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgIGNhc2UgXCJ7XCI6IHJldHVybiB0aGlzLk9iamVjdExpdGVyYWwoKTtcbiAgICAgICAgICAgIGNhc2UgXCIoXCI6IHJldHVybiB0aGlzLlBhcmVuRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgY2FzZSBcIltcIjogcmV0dXJuIHRoaXMuQXJyYXlMaXRlcmFsKCk7XG4gICAgICAgICAgICBjYXNlIFwiQVROQU1FXCI6IHJldHVybiB0aGlzLkF0TmFtZSgpO1xuXG4gICAgICAgICAgICBjYXNlIFwiSURFTlRJRklFUlwiOlxuXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBrZXl3b3JkRnJvbVRva2VuKHRva2VuKTtcbiAgICAgICAgICAgICAgICBuZXh0ID0gdGhpcy5wZWVrVG9rZW5BdChcImRpdlwiLCAxKTtcblxuICAgICAgICAgICAgICAgIGlmICghbmV4dC5uZXdsaW5lQmVmb3JlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG5leHQudHlwZSA9PT0gXCI9PlwiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHVzaENvbnRleHQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5BcnJvd0Z1bmN0aW9uSGVhZChcIlwiLCB0aGlzLkJpbmRpbmdJZGVudGlmaWVyKCksIHN0YXJ0KTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG5leHQudHlwZSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkZ1bmN0aW9uRXhwcmVzc2lvbigpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmV4dC50eXBlID09PSBcIklERU5USUZJRVJcIiAmJiBpc0Z1bmN0aW9uTW9kaWZpZXIodmFsdWUpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wdXNoQ29udGV4dCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkFycm93RnVuY3Rpb25IZWFkKHZhbHVlLCB0aGlzLkJpbmRpbmdJZGVudGlmaWVyKCksIHN0YXJ0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLklkZW50aWZpZXIodHJ1ZSk7XG5cbiAgICAgICAgICAgIGNhc2UgXCJSRUdFWFwiOiByZXR1cm4gdGhpcy5SZWd1bGFyRXhwcmVzc2lvbigpO1xuXG4gICAgICAgICAgICBjYXNlIFwibnVsbFwiOlxuICAgICAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQVNULk51bGxMaXRlcmFsKHRva2VuLnN0YXJ0LCB0b2tlbi5lbmQpO1xuXG4gICAgICAgICAgICBjYXNlIFwidHJ1ZVwiOlxuICAgICAgICAgICAgY2FzZSBcImZhbHNlXCI6XG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBBU1QuQm9vbGVhbkxpdGVyYWwodHlwZSA9PT0gXCJ0cnVlXCIsIHRva2VuLnN0YXJ0LCB0b2tlbi5lbmQpO1xuXG4gICAgICAgICAgICBjYXNlIFwidGhpc1wiOlxuICAgICAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQVNULlRoaXNFeHByZXNzaW9uKHRva2VuLnN0YXJ0LCB0b2tlbi5lbmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51bmV4cGVjdGVkKHRva2VuKTtcbiAgICB9XG5cbiAgICBJZGVudGlmaWVyKGlzVmFyKSB7XG5cbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5yZWFkVG9rZW4oXCJJREVOVElGSUVSXCIpLFxuICAgICAgICAgICAgbm9kZSA9IG5ldyBBU1QuSWRlbnRpZmllcih0b2tlbi52YWx1ZSwgaXNWYXIgPyBcInZhcmlhYmxlXCIgOiBcIlwiLCB0b2tlbi5zdGFydCwgdG9rZW4uZW5kKTtcblxuICAgICAgICB0aGlzLmNoZWNrSWRlbnRpZmllcihub2RlKTtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgSWRlbnRpZmllck5hbWUoKSB7XG5cbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5yZWFkVG9rZW4oXCJJREVOVElGSUVSXCIsIFwibmFtZVwiKTtcbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuSWRlbnRpZmllcih0b2tlbi52YWx1ZSwgXCJcIiwgdG9rZW4uc3RhcnQsIHRva2VuLmVuZCk7XG4gICAgfVxuXG4gICAgQXROYW1lKCkge1xuXG4gICAgICAgIC8vIFRPRE86ICBPbmx5IGFsbG93IHdpdGhpbiBjbGFzcz8gIFdoYXQgYWJvdXQgbmVzdGVkIGNsYXNzZXM/XG5cbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5yZWFkVG9rZW4oXCJBVE5BTUVcIik7XG4gICAgICAgIHJldHVybiBuZXcgQVNULkF0TmFtZSh0b2tlbi52YWx1ZSwgdG9rZW4uc3RhcnQsIHRva2VuLmVuZCk7XG4gICAgfVxuXG4gICAgU3RyaW5nTGl0ZXJhbCgpIHtcblxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnJlYWRUb2tlbihcIlNUUklOR1wiKSxcbiAgICAgICAgICAgIG5vZGUgPSBuZXcgQVNULlN0cmluZ0xpdGVyYWwodG9rZW4udmFsdWUsIHRva2VuLnN0YXJ0LCB0b2tlbi5lbmQpO1xuXG4gICAgICAgIGlmICh0b2tlbi5zdHJpY3RFcnJvcilcbiAgICAgICAgICAgIHRoaXMuYWRkU3RyaWN0RXJyb3IodG9rZW4uc3RyaWN0RXJyb3IsIG5vZGUpO1xuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIE51bWJlckxpdGVyYWwoKSB7XG5cbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5yZWFkVG9rZW4oXCJOVU1CRVJcIiksXG4gICAgICAgICAgICBub2RlID0gbmV3IEFTVC5OdW1iZXJMaXRlcmFsKHRva2VuLm51bWJlciwgdG9rZW4uc3RhcnQsIHRva2VuLmVuZCk7XG5cbiAgICAgICAgaWYgKHRva2VuLnN0cmljdEVycm9yKVxuICAgICAgICAgICAgdGhpcy5hZGRTdHJpY3RFcnJvcih0b2tlbi5zdHJpY3RFcnJvciwgbm9kZSk7XG5cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgVGVtcGxhdGVQYXJ0KCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucmVhZFRva2VuKFwiVEVNUExBVEVcIiwgXCJ0ZW1wbGF0ZVwiKSxcbiAgICAgICAgICAgIGVuZCA9IHRva2VuLnRlbXBsYXRlRW5kLFxuICAgICAgICAgICAgbm9kZTtcblxuICAgICAgICBub2RlID0gbmV3IEFTVC5UZW1wbGF0ZVBhcnQoXG4gICAgICAgICAgICB0b2tlbi52YWx1ZSxcbiAgICAgICAgICAgIHRoaXMuc2Nhbm5lci5yYXdWYWx1ZSh0b2tlbi5zdGFydCArIDEsIHRva2VuLmVuZCAtIChlbmQgPyAxIDogMikpLFxuICAgICAgICAgICAgZW5kLFxuICAgICAgICAgICAgdG9rZW4uc3RhcnQsXG4gICAgICAgICAgICB0b2tlbi5lbmQpO1xuXG4gICAgICAgIGlmICh0b2tlbi5zdHJpY3RFcnJvcilcbiAgICAgICAgICAgIHRoaXMuYWRkU3RyaWN0RXJyb3IodG9rZW4uc3RyaWN0RXJyb3IsIG5vZGUpO1xuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIFJlZ3VsYXJFeHByZXNzaW9uKCkge1xuXG4gICAgICAgIC8vIFRPRE86ICBWYWxpZGF0ZSByZWd1bGFyIGV4cHJlc3Npb24gYWdhaW5zdCBSZWdFeHAgZ3JhbW1hciAoMjEuMi4xKVxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnJlYWRUb2tlbihcIlJFR0VYXCIpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULlJlZ3VsYXJFeHByZXNzaW9uKFxuICAgICAgICAgICAgdG9rZW4udmFsdWUsXG4gICAgICAgICAgICB0b2tlbi5yZWdleEZsYWdzLFxuICAgICAgICAgICAgdG9rZW4uc3RhcnQsXG4gICAgICAgICAgICB0b2tlbi5lbmQpO1xuICAgIH1cblxuICAgIEJpbmRpbmdJZGVudGlmaWVyKCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucmVhZFRva2VuKFwiSURFTlRJRklFUlwiKSxcbiAgICAgICAgICAgIG5vZGUgPSBuZXcgQVNULklkZW50aWZpZXIodG9rZW4udmFsdWUsIFwiXCIsIHRva2VuLnN0YXJ0LCB0b2tlbi5lbmQpO1xuXG4gICAgICAgIHRoaXMuY2hlY2tCaW5kaW5nVGFyZ2V0KG5vZGUpO1xuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICBCaW5kaW5nUGF0dGVybigpIHtcblxuICAgICAgICBsZXQgbm9kZTtcblxuICAgICAgICBzd2l0Y2ggKHRoaXMucGVlaygpKSB7XG5cbiAgICAgICAgICAgIGNhc2UgXCJ7XCI6XG4gICAgICAgICAgICAgICAgbm9kZSA9IHRoaXMuT2JqZWN0TGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwiW1wiOlxuICAgICAgICAgICAgICAgIG5vZGUgPSB0aGlzLkFycmF5TGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkJpbmRpbmdJZGVudGlmaWVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNoZWNrQmluZGluZ1RhcmdldChub2RlKTtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgUGFyZW5FeHByZXNzaW9uKCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBleHByID0gbnVsbCxcbiAgICAgICAgICAgIHJlc3QgPSBudWxsO1xuXG4gICAgICAgIC8vIFB1c2ggYSBuZXcgY29udGV4dCBpbiBjYXNlIHdlIGFyZSBwYXJzaW5nIGFuIGFycm93IGZ1bmN0aW9uXG4gICAgICAgIHRoaXMucHVzaE1heWJlQ29udGV4dCgpO1xuXG4gICAgICAgIHRoaXMucmVhZChcIihcIik7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLnBlZWsoKSkge1xuXG4gICAgICAgICAgICAvLyBBbiBlbXB0eSBhcnJvdyBmdW5jdGlvbiBmb3JtYWwgbGlzdFxuICAgICAgICAgICAgY2FzZSBcIilcIjpcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgLy8gUGFyZW4gZXhwcmVzc2lvblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBleHByID0gdGhpcy5FeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlYWQoXCIpXCIpO1xuXG4gICAgICAgIGxldCBuZXh0ID0gdGhpcy5wZWVrVG9rZW4oXCJkaXZcIik7XG5cbiAgICAgICAgaWYgKCFuZXh0Lm5ld2xpbmVCZWZvcmUgJiYgKG5leHQudHlwZSA9PT0gXCI9PlwiIHx8IGV4cHIgPT09IG51bGwpKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuQXJyb3dGdW5jdGlvbkhlYWQoXCJcIiwgZXhwciwgc3RhcnQpO1xuXG4gICAgICAgIC8vIENvbGxhcHNlIHRoaXMgY29udGV4dCBpbnRvIGl0cyBwYXJlbnRcbiAgICAgICAgdGhpcy5wb3BDb250ZXh0KHRydWUpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULlBhcmVuRXhwcmVzc2lvbihleHByLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIE9iamVjdExpdGVyYWwoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGNvbW1hID0gZmFsc2UsXG4gICAgICAgICAgICBsaXN0ID0gW10sXG4gICAgICAgICAgICBub2RlO1xuXG4gICAgICAgIHRoaXMucmVhZChcIntcIik7XG5cbiAgICAgICAgd2hpbGUgKHRoaXMucGVla1VudGlsKFwifVwiLCBcIm5hbWVcIikpIHtcblxuICAgICAgICAgICAgaWYgKCFjb21tYSAmJiBub2RlKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlYWQoXCIsXCIpO1xuICAgICAgICAgICAgICAgIGNvbW1hID0gdHJ1ZTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGNvbW1hID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKG5vZGUgPSB0aGlzLlByb3BlcnR5RGVmaW5pdGlvbigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVhZChcIn1cIik7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuT2JqZWN0TGl0ZXJhbChsaXN0LCBjb21tYSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBQcm9wZXJ0eURlZmluaXRpb24oKSB7XG5cbiAgICAgICAgaWYgKHRoaXMucGVlayhcIm5hbWVcIikgPT09IFwiKlwiKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuTWV0aG9kRGVmaW5pdGlvbigpO1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgbmFtZTtcblxuICAgICAgICBzd2l0Y2ggKHRoaXMucGVla0F0KFwibmFtZVwiLCAxKSkge1xuXG4gICAgICAgICAgICBjYXNlIFwiPVwiOlxuXG4gICAgICAgICAgICAgICAgLy8gUmUtcmVhZCB0b2tlbiBhcyBhbiBpZGVudGlmaWVyXG4gICAgICAgICAgICAgICAgdGhpcy51bnBlZWsoKTtcblxuICAgICAgICAgICAgICAgIG5vZGUgPSBuZXcgQVNULlBhdHRlcm5Qcm9wZXJ0eShcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5JZGVudGlmaWVyKHRydWUpLFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICAodGhpcy5yZWFkKCksIHRoaXMuQXNzaWdubWVudEV4cHJlc3Npb24oKSksXG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmFkZEludmFsaWROb2RlKFwiSW52YWxpZCBwcm9wZXJ0eSBkZWZpbml0aW9uIGluIG9iamVjdCBsaXRlcmFsXCIsIG5vZGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBub2RlO1xuXG4gICAgICAgICAgICBjYXNlIFwiLFwiOlxuICAgICAgICAgICAgY2FzZSBcIn1cIjpcblxuICAgICAgICAgICAgICAgIC8vIFJlLXJlYWQgdG9rZW4gYXMgYW4gaWRlbnRpZmllclxuICAgICAgICAgICAgICAgIHRoaXMudW5wZWVrKCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEFTVC5Qcm9wZXJ0eURlZmluaXRpb24oXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuSWRlbnRpZmllcih0cnVlKSxcbiAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5hbWUgPSB0aGlzLlByb3BlcnR5TmFtZSgpO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsoXCJuYW1lXCIpID09PSBcIjpcIikge1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3IEFTVC5Qcm9wZXJ0eURlZmluaXRpb24oXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICAodGhpcy5yZWFkKCksIHRoaXMuQXNzaWdubWVudEV4cHJlc3Npb24oKSksXG4gICAgICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICAgICAgdGhpcy5ub2RlRW5kKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuTWV0aG9kRGVmaW5pdGlvbihuYW1lKTtcbiAgICB9XG5cbiAgICBQcm9wZXJ0eU5hbWUoKSB7XG5cbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5wZWVrVG9rZW4oXCJuYW1lXCIpO1xuXG4gICAgICAgIHN3aXRjaCAodG9rZW4udHlwZSkge1xuXG4gICAgICAgICAgICBjYXNlIFwiSURFTlRJRklFUlwiOiByZXR1cm4gdGhpcy5JZGVudGlmaWVyTmFtZSgpO1xuICAgICAgICAgICAgY2FzZSBcIlNUUklOR1wiOiByZXR1cm4gdGhpcy5TdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICBjYXNlIFwiTlVNQkVSXCI6IHJldHVybiB0aGlzLk51bWJlckxpdGVyYWwoKTtcbiAgICAgICAgICAgIGNhc2UgXCJbXCI6IHJldHVybiB0aGlzLkNvbXB1dGVkUHJvcGVydHlOYW1lKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnVuZXhwZWN0ZWQodG9rZW4pO1xuICAgIH1cblxuICAgIENvbXB1dGVkUHJvcGVydHlOYW1lKCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiW1wiKTtcbiAgICAgICAgbGV0IGV4cHIgPSB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKCk7XG4gICAgICAgIHRoaXMucmVhZChcIl1cIik7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuQ29tcHV0ZWRQcm9wZXJ0eU5hbWUoZXhwciwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBBcnJheUxpdGVyYWwoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGNvbW1hID0gZmFsc2UsXG4gICAgICAgICAgICBsaXN0ID0gW10sXG4gICAgICAgICAgICB0eXBlO1xuXG4gICAgICAgIHRoaXMucmVhZChcIltcIik7XG5cbiAgICAgICAgd2hpbGUgKHR5cGUgPSB0aGlzLnBlZWtVbnRpbChcIl1cIikpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IFwiLFwiKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgICAgICBjb21tYSA9IHRydWU7XG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKG51bGwpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKHRoaXMuQXNzaWdubWVudEV4cHJlc3Npb24oZmFsc2UsIHRydWUpKTtcbiAgICAgICAgICAgICAgICBjb21tYSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGVlaygpICE9PSBcIl1cIikge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZChcIixcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvbW1hID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlYWQoXCJdXCIpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkFycmF5TGl0ZXJhbChsaXN0LCBjb21tYSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBUZW1wbGF0ZUV4cHJlc3Npb24oKSB7XG5cbiAgICAgICAgbGV0IGF0b20gPSB0aGlzLlRlbXBsYXRlUGFydCgpLFxuICAgICAgICAgICAgc3RhcnQgPSBhdG9tLnN0YXJ0LFxuICAgICAgICAgICAgbGl0ID0gW2F0b21dLFxuICAgICAgICAgICAgc3ViID0gW107XG5cbiAgICAgICAgd2hpbGUgKCFhdG9tLnRlbXBsYXRlRW5kKSB7XG5cbiAgICAgICAgICAgIHN1Yi5wdXNoKHRoaXMuRXhwcmVzc2lvbigpKTtcblxuICAgICAgICAgICAgLy8gRGlzY2FyZCBhbnkgdG9rZW5zIHRoYXQgaGF2ZSBiZWVuIHNjYW5uZWQgdXNpbmcgYSBkaWZmZXJlbnQgY29udGV4dFxuICAgICAgICAgICAgdGhpcy51bnBlZWsoKTtcblxuICAgICAgICAgICAgbGl0LnB1c2goYXRvbSA9IHRoaXMuVGVtcGxhdGVQYXJ0KCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuVGVtcGxhdGVFeHByZXNzaW9uKGxpdCwgc3ViLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIC8vID09PSBTdGF0ZW1lbnRzID09PVxuXG4gICAgU3RhdGVtZW50KGxhYmVsKSB7XG5cbiAgICAgICAgbGV0IG5leHQ7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLnBlZWsoKSkge1xuXG4gICAgICAgICAgICBjYXNlIFwiSURFTlRJRklFUlwiOlxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGVla0F0KFwiZGl2XCIsIDEpID09PSBcIjpcIilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuTGFiZWxsZWRTdGF0ZW1lbnQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkV4cHJlc3Npb25TdGF0ZW1lbnQoKTtcblxuICAgICAgICAgICAgY2FzZSBcIntcIjogcmV0dXJuIHRoaXMuQmxvY2soKTtcbiAgICAgICAgICAgIGNhc2UgXCI7XCI6IHJldHVybiB0aGlzLkVtcHR5U3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlIFwidmFyXCI6IHJldHVybiB0aGlzLlZhcmlhYmxlU3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlIFwicmV0dXJuXCI6IHJldHVybiB0aGlzLlJldHVyblN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSBcImJyZWFrXCI6IHJldHVybiB0aGlzLkJyZWFrU3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlIFwiY29udGludWVcIjogcmV0dXJuIHRoaXMuQ29udGludWVTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGNhc2UgXCJ0aHJvd1wiOiByZXR1cm4gdGhpcy5UaHJvd1N0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSBcImRlYnVnZ2VyXCI6IHJldHVybiB0aGlzLkRlYnVnZ2VyU3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlIFwiaWZcIjogcmV0dXJuIHRoaXMuSWZTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGNhc2UgXCJkb1wiOiByZXR1cm4gdGhpcy5Eb1doaWxlU3RhdGVtZW50KGxhYmVsKTtcbiAgICAgICAgICAgIGNhc2UgXCJ3aGlsZVwiOiByZXR1cm4gdGhpcy5XaGlsZVN0YXRlbWVudChsYWJlbCk7XG4gICAgICAgICAgICBjYXNlIFwiZm9yXCI6IHJldHVybiB0aGlzLkZvclN0YXRlbWVudChsYWJlbCk7XG4gICAgICAgICAgICBjYXNlIFwid2l0aFwiOiByZXR1cm4gdGhpcy5XaXRoU3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlIFwic3dpdGNoXCI6IHJldHVybiB0aGlzLlN3aXRjaFN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSBcInRyeVwiOiByZXR1cm4gdGhpcy5UcnlTdGF0ZW1lbnQoKTtcblxuICAgICAgICAgICAgZGVmYXVsdDogcmV0dXJuIHRoaXMuRXhwcmVzc2lvblN0YXRlbWVudCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgQmxvY2soKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCJ7XCIpO1xuICAgICAgICBsZXQgbGlzdCA9IHRoaXMuU3RhdGVtZW50TGlzdChmYWxzZSwgZmFsc2UpO1xuICAgICAgICB0aGlzLnJlYWQoXCJ9XCIpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkJsb2NrKGxpc3QsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgU2VtaWNvbG9uKCkge1xuXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVla1Rva2VuKCksXG4gICAgICAgICAgICB0eXBlID0gdG9rZW4udHlwZTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gXCI7XCIgfHwgISh0eXBlID09PSBcIn1cIiB8fCB0eXBlID09PSBcIkVPRlwiIHx8IHRva2VuLm5ld2xpbmVCZWZvcmUpKVxuICAgICAgICAgICAgdGhpcy5yZWFkKFwiO1wiKTtcbiAgICB9XG5cbiAgICBMYWJlbGxlZFN0YXRlbWVudCgpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgbGFiZWwgPSB0aGlzLklkZW50aWZpZXIoKSxcbiAgICAgICAgICAgIG5hbWUgPSBsYWJlbC52YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5nZXRMYWJlbChuYW1lKSA+IDApXG4gICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIGxhYmVsXCIsIGxhYmVsKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCI6XCIpO1xuXG4gICAgICAgIHRoaXMuc2V0TGFiZWwobmFtZSwgMSk7XG4gICAgICAgIGxldCBzdGF0ZW1lbnQgPSB0aGlzLlN0YXRlbWVudChuYW1lKTtcbiAgICAgICAgdGhpcy5zZXRMYWJlbChuYW1lLCAwKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5MYWJlbGxlZFN0YXRlbWVudChcbiAgICAgICAgICAgIGxhYmVsLFxuICAgICAgICAgICAgc3RhdGVtZW50LFxuICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgRXhwcmVzc2lvblN0YXRlbWVudCgpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgZXhwciA9IHRoaXMuRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHRoaXMuU2VtaWNvbG9uKCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuRXhwcmVzc2lvblN0YXRlbWVudChleHByLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIEVtcHR5U3RhdGVtZW50KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5TZW1pY29sb24oKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5FbXB0eVN0YXRlbWVudChzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIFZhcmlhYmxlU3RhdGVtZW50KCkge1xuXG4gICAgICAgIGxldCBub2RlID0gdGhpcy5WYXJpYWJsZURlY2xhcmF0aW9uKGZhbHNlKTtcblxuICAgICAgICB0aGlzLlNlbWljb2xvbigpO1xuICAgICAgICBub2RlLmVuZCA9IHRoaXMubm9kZUVuZCgpO1xuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIFZhcmlhYmxlRGVjbGFyYXRpb24obm9Jbikge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMucGVla1Rva2VuKCksXG4gICAgICAgICAgICBraW5kID0gdG9rZW4udHlwZSxcbiAgICAgICAgICAgIGxpc3QgPSBbXTtcblxuICAgICAgICBzd2l0Y2ggKGtpbmQpIHtcblxuICAgICAgICAgICAgY2FzZSBcInZhclwiOlxuICAgICAgICAgICAgY2FzZSBcImNvbnN0XCI6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJJREVOVElGSUVSXCI6XG5cbiAgICAgICAgICAgICAgICBpZiAodG9rZW4udmFsdWUgPT09IFwibGV0XCIpIHtcblxuICAgICAgICAgICAgICAgICAgICBraW5kID0gXCJsZXRcIjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRoaXMuZmFpbChcIkV4cGVjdGVkIHZhciwgY29uc3QsIG9yIGxldFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVhZCgpO1xuXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG5cbiAgICAgICAgICAgIGxpc3QucHVzaCh0aGlzLlZhcmlhYmxlRGVjbGFyYXRvcihub0luLCBraW5kKSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnBlZWsoKSA9PT0gXCIsXCIpIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgZWxzZSBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgQVNULlZhcmlhYmxlRGVjbGFyYXRpb24oa2luZCwgbGlzdCwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBWYXJpYWJsZURlY2xhcmF0b3Iobm9Jbiwga2luZCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBwYXR0ZXJuID0gdGhpcy5CaW5kaW5nUGF0dGVybigpLFxuICAgICAgICAgICAgaW5pdCA9IG51bGw7XG5cbiAgICAgICAgaWYgKCghbm9JbiAmJiBwYXR0ZXJuLnR5cGUgIT09IFwiSWRlbnRpZmllclwiKSB8fCB0aGlzLnBlZWsoKSA9PT0gXCI9XCIpIHtcblxuICAgICAgICAgICAgLy8gTk9URTogUGF0dGVybnMgbXVzdCBoYXZlIGluaXRpYWxpemVycyB3aGVuIG5vdCBpbiBkZWNsYXJhdGlvblxuICAgICAgICAgICAgLy8gc2VjdGlvbiBvZiBhIGZvciBzdGF0ZW1lbnRcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICBpbml0ID0gdGhpcy5Bc3NpZ25tZW50RXhwcmVzc2lvbihub0luKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGtpbmQgPT09IFwiY29uc3RcIikge1xuXG4gICAgICAgICAgICB0aGlzLmZhaWwoXCJNaXNzaW5nIGNvbnN0IGluaXRpYWxpemVyXCIsIHBhdHRlcm4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuVmFyaWFibGVEZWNsYXJhdG9yKHBhdHRlcm4sIGluaXQsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgUmV0dXJuU3RhdGVtZW50KCkge1xuXG4gICAgICAgIGlmICghdGhpcy5jb250ZXh0LmlzRnVuY3Rpb24pXG4gICAgICAgICAgICB0aGlzLmZhaWwoXCJSZXR1cm4gc3RhdGVtZW50IG91dHNpZGUgb2YgZnVuY3Rpb25cIik7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCJyZXR1cm5cIik7XG4gICAgICAgIGxldCB2YWx1ZSA9IHRoaXMucGVla0VuZCgpID8gbnVsbCA6IHRoaXMuRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHRoaXMuU2VtaWNvbG9uKCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuUmV0dXJuU3RhdGVtZW50KHZhbHVlLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIEJyZWFrU3RhdGVtZW50KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBjb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgICAgIHRoaXMucmVhZChcImJyZWFrXCIpO1xuICAgICAgICBsZXQgbGFiZWwgPSB0aGlzLnBlZWtFbmQoKSA/IG51bGwgOiB0aGlzLklkZW50aWZpZXIoKTtcbiAgICAgICAgdGhpcy5TZW1pY29sb24oKTtcblxuICAgICAgICBsZXQgbm9kZSA9IG5ldyBBU1QuQnJlYWtTdGF0ZW1lbnQobGFiZWwsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG5cbiAgICAgICAgaWYgKGxhYmVsKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmdldExhYmVsKGxhYmVsLnZhbHVlKSA9PT0gMClcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIGxhYmVsXCIsIGxhYmVsKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGNvbnRleHQubG9vcERlcHRoID09PSAwICYmIGNvbnRleHQuc3dpdGNoRGVwdGggPT09IDApIHtcblxuICAgICAgICAgICAgdGhpcy5mYWlsKFwiQnJlYWsgbm90IGNvbnRhaW5lZCB3aXRoaW4gYSBzd2l0Y2ggb3IgbG9vcFwiLCBub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIENvbnRpbnVlU3RhdGVtZW50KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBjb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgICAgIHRoaXMucmVhZChcImNvbnRpbnVlXCIpO1xuICAgICAgICBsZXQgbGFiZWwgPSB0aGlzLnBlZWtFbmQoKSA/IG51bGwgOiB0aGlzLklkZW50aWZpZXIoKTtcbiAgICAgICAgdGhpcy5TZW1pY29sb24oKTtcblxuICAgICAgICBsZXQgbm9kZSA9IG5ldyBBU1QuQ29udGludWVTdGF0ZW1lbnQobGFiZWwsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG5cbiAgICAgICAgaWYgKGxhYmVsKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmdldExhYmVsKGxhYmVsLnZhbHVlKSAhPT0gMilcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIGxhYmVsXCIsIGxhYmVsKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGNvbnRleHQubG9vcERlcHRoID09PSAwKSB7XG5cbiAgICAgICAgICAgIHRoaXMuZmFpbChcIkNvbnRpbnVlIG5vdCBjb250YWluZWQgd2l0aGluIGEgbG9vcFwiLCBub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIFRocm93U3RhdGVtZW50KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwidGhyb3dcIik7XG5cbiAgICAgICAgbGV0IGV4cHIgPSB0aGlzLnBlZWtFbmQoKSA/IG51bGwgOiB0aGlzLkV4cHJlc3Npb24oKTtcblxuICAgICAgICBpZiAoZXhwciA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuZmFpbChcIk1pc3NpbmcgdGhyb3cgZXhwcmVzc2lvblwiKTtcblxuICAgICAgICB0aGlzLlNlbWljb2xvbigpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULlRocm93U3RhdGVtZW50KGV4cHIsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgRGVidWdnZXJTdGF0ZW1lbnQoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCJkZWJ1Z2dlclwiKTtcbiAgICAgICAgdGhpcy5TZW1pY29sb24oKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5EZWJ1Z2dlclN0YXRlbWVudChzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIElmU3RhdGVtZW50KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiaWZcIik7XG4gICAgICAgIHRoaXMucmVhZChcIihcIik7XG5cbiAgICAgICAgbGV0IHRlc3QgPSB0aGlzLkV4cHJlc3Npb24oKSxcbiAgICAgICAgICAgIGJvZHkgPSBudWxsLFxuICAgICAgICAgICAgZWxzZUJvZHkgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVhZChcIilcIik7XG4gICAgICAgIGJvZHkgPSB0aGlzLlN0YXRlbWVudCgpO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsoKSA9PT0gXCJlbHNlXCIpIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICBlbHNlQm9keSA9IHRoaXMuU3RhdGVtZW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5JZlN0YXRlbWVudCh0ZXN0LCBib2R5LCBlbHNlQm9keSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBEb1doaWxlU3RhdGVtZW50KGxhYmVsKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICB0ZXN0O1xuXG4gICAgICAgIGlmIChsYWJlbClcbiAgICAgICAgICAgIHRoaXMuc2V0TGFiZWwobGFiZWwsIDIpO1xuXG4gICAgICAgIHRoaXMucmVhZChcImRvXCIpO1xuXG4gICAgICAgIHRoaXMuY29udGV4dC5sb29wRGVwdGggKz0gMTtcbiAgICAgICAgYm9keSA9IHRoaXMuU3RhdGVtZW50KCk7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb29wRGVwdGggLT0gMTtcblxuICAgICAgICB0aGlzLnJlYWQoXCJ3aGlsZVwiKTtcbiAgICAgICAgdGhpcy5yZWFkKFwiKFwiKTtcblxuICAgICAgICB0ZXN0ID0gdGhpcy5FeHByZXNzaW9uKCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiKVwiKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5Eb1doaWxlU3RhdGVtZW50KGJvZHksIHRlc3QsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgV2hpbGVTdGF0ZW1lbnQobGFiZWwpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpO1xuXG4gICAgICAgIGlmIChsYWJlbClcbiAgICAgICAgICAgIHRoaXMuc2V0TGFiZWwobGFiZWwsIDIpO1xuXG4gICAgICAgIHRoaXMucmVhZChcIndoaWxlXCIpO1xuICAgICAgICB0aGlzLnJlYWQoXCIoXCIpO1xuICAgICAgICBsZXQgZXhwciA9IHRoaXMuRXhwcmVzc2lvbigpO1xuICAgICAgICB0aGlzLnJlYWQoXCIpXCIpO1xuXG4gICAgICAgIHRoaXMuY29udGV4dC5sb29wRGVwdGggKz0gMTtcbiAgICAgICAgbGV0IHN0YXRlbWVudCA9IHRoaXMuU3RhdGVtZW50KCk7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb29wRGVwdGggLT0gMTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5XaGlsZVN0YXRlbWVudChcbiAgICAgICAgICAgIGV4cHIsXG4gICAgICAgICAgICBzdGF0ZW1lbnQsXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBGb3JTdGF0ZW1lbnQobGFiZWwpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgaW5pdCA9IG51bGwsXG4gICAgICAgICAgICBhc3luYyA9IGZhbHNlLFxuICAgICAgICAgICAgdGVzdCxcbiAgICAgICAgICAgIHN0ZXA7XG5cbiAgICAgICAgaWYgKGxhYmVsKVxuICAgICAgICAgICAgdGhpcy5zZXRMYWJlbChsYWJlbCwgMik7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiZm9yXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLmNvbnRleHQuaXNBc3luYyAmJiB0aGlzLnBlZWtLZXl3b3JkKFwiYXN5bmNcIikpIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICBhc3luYyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlYWQoXCIoXCIpO1xuXG4gICAgICAgIC8vIEdldCBsb29wIGluaXRpYWxpemVyXG4gICAgICAgIHN3aXRjaCAodGhpcy5wZWVrKCkpIHtcblxuICAgICAgICAgICAgY2FzZSBcIjtcIjpcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcInZhclwiOlxuICAgICAgICAgICAgY2FzZSBcImNvbnN0XCI6XG4gICAgICAgICAgICAgICAgaW5pdCA9IHRoaXMuVmFyaWFibGVEZWNsYXJhdGlvbih0cnVlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcIklERU5USUZJRVJcIjpcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBlZWtMZXQoKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGluaXQgPSB0aGlzLlZhcmlhYmxlRGVjbGFyYXRpb24odHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBpbml0ID0gdGhpcy5FeHByZXNzaW9uKHRydWUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFzeW5jIHx8IGluaXQgJiYgdGhpcy5wZWVrS2V5d29yZChcIm9mXCIpKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRm9yT2ZTdGF0ZW1lbnQoYXN5bmMsIGluaXQsIHN0YXJ0KTtcblxuICAgICAgICBpZiAoaW5pdCAmJiB0aGlzLnBlZWsoKSA9PT0gXCJpblwiKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRm9ySW5TdGF0ZW1lbnQoaW5pdCwgc3RhcnQpO1xuXG4gICAgICAgIHRoaXMucmVhZChcIjtcIik7XG4gICAgICAgIHRlc3QgPSB0aGlzLnBlZWsoKSA9PT0gXCI7XCIgPyBudWxsIDogdGhpcy5FeHByZXNzaW9uKCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiO1wiKTtcbiAgICAgICAgc3RlcCA9IHRoaXMucGVlaygpID09PSBcIilcIiA/IG51bGwgOiB0aGlzLkV4cHJlc3Npb24oKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCIpXCIpO1xuXG4gICAgICAgIHRoaXMuY29udGV4dC5sb29wRGVwdGggKz0gMTtcbiAgICAgICAgbGV0IHN0YXRlbWVudCA9IHRoaXMuU3RhdGVtZW50KCk7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb29wRGVwdGggLT0gMTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5Gb3JTdGF0ZW1lbnQoXG4gICAgICAgICAgICBpbml0LFxuICAgICAgICAgICAgdGVzdCxcbiAgICAgICAgICAgIHN0ZXAsXG4gICAgICAgICAgICBzdGF0ZW1lbnQsXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBGb3JJblN0YXRlbWVudChpbml0LCBzdGFydCkge1xuXG4gICAgICAgIHRoaXMuY2hlY2tGb3JJbml0KGluaXQsIFwiaW5cIik7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiaW5cIik7XG4gICAgICAgIGxldCBleHByID0gdGhpcy5FeHByZXNzaW9uKCk7XG4gICAgICAgIHRoaXMucmVhZChcIilcIik7XG5cbiAgICAgICAgdGhpcy5jb250ZXh0Lmxvb3BEZXB0aCArPSAxO1xuICAgICAgICBsZXQgc3RhdGVtZW50ID0gdGhpcy5TdGF0ZW1lbnQoKTtcbiAgICAgICAgdGhpcy5jb250ZXh0Lmxvb3BEZXB0aCAtPSAxO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkZvckluU3RhdGVtZW50KFxuICAgICAgICAgICAgaW5pdCxcbiAgICAgICAgICAgIGV4cHIsXG4gICAgICAgICAgICBzdGF0ZW1lbnQsXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBGb3JPZlN0YXRlbWVudChhc3luYywgaW5pdCwgc3RhcnQpIHtcblxuICAgICAgICB0aGlzLmNoZWNrRm9ySW5pdChpbml0LCBcIm9mXCIpO1xuXG4gICAgICAgIHRoaXMucmVhZEtleXdvcmQoXCJvZlwiKTtcbiAgICAgICAgbGV0IGV4cHIgPSB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKCk7XG4gICAgICAgIHRoaXMucmVhZChcIilcIik7XG5cbiAgICAgICAgdGhpcy5jb250ZXh0Lmxvb3BEZXB0aCArPSAxO1xuICAgICAgICBsZXQgc3RhdGVtZW50ID0gdGhpcy5TdGF0ZW1lbnQoKTtcbiAgICAgICAgdGhpcy5jb250ZXh0Lmxvb3BEZXB0aCAtPSAxO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkZvck9mU3RhdGVtZW50KFxuICAgICAgICAgICAgYXN5bmMsXG4gICAgICAgICAgICBpbml0LFxuICAgICAgICAgICAgZXhwcixcbiAgICAgICAgICAgIHN0YXRlbWVudCxcbiAgICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgICAgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIFdpdGhTdGF0ZW1lbnQoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCJ3aXRoXCIpO1xuICAgICAgICB0aGlzLnJlYWQoXCIoXCIpO1xuXG4gICAgICAgIGxldCBub2RlID0gbmV3IEFTVC5XaXRoU3RhdGVtZW50KFxuICAgICAgICAgICAgdGhpcy5FeHByZXNzaW9uKCksXG4gICAgICAgICAgICAodGhpcy5yZWFkKFwiKVwiKSwgdGhpcy5TdGF0ZW1lbnQoKSksXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcblxuICAgICAgICB0aGlzLmFkZFN0cmljdEVycm9yKFwiV2l0aCBzdGF0ZW1lbnQgaXMgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGVcIiwgbm9kZSk7XG5cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgU3dpdGNoU3RhdGVtZW50KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwic3dpdGNoXCIpO1xuICAgICAgICB0aGlzLnJlYWQoXCIoXCIpO1xuXG4gICAgICAgIGxldCBoZWFkID0gdGhpcy5FeHByZXNzaW9uKCksXG4gICAgICAgICAgICBoYXNEZWZhdWx0ID0gZmFsc2UsXG4gICAgICAgICAgICBjYXNlcyA9IFtdLFxuICAgICAgICAgICAgbm9kZTtcblxuICAgICAgICB0aGlzLnJlYWQoXCIpXCIpO1xuICAgICAgICB0aGlzLnJlYWQoXCJ7XCIpO1xuICAgICAgICB0aGlzLmNvbnRleHQuc3dpdGNoRGVwdGggKz0gMTtcblxuICAgICAgICB3aGlsZSAodGhpcy5wZWVrVW50aWwoXCJ9XCIpKSB7XG5cbiAgICAgICAgICAgIG5vZGUgPSB0aGlzLlN3aXRjaENhc2UoKTtcblxuICAgICAgICAgICAgaWYgKG5vZGUudGVzdCA9PT0gbnVsbCkge1xuXG4gICAgICAgICAgICAgICAgaWYgKGhhc0RlZmF1bHQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbChcIlN3aXRjaCBzdGF0ZW1lbnQgY2Fubm90IGhhdmUgbW9yZSB0aGFuIG9uZSBkZWZhdWx0XCIsIG5vZGUpO1xuXG4gICAgICAgICAgICAgICAgaGFzRGVmYXVsdCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2VzLnB1c2gobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnRleHQuc3dpdGNoRGVwdGggLT0gMTtcbiAgICAgICAgdGhpcy5yZWFkKFwifVwiKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5Td2l0Y2hTdGF0ZW1lbnQoaGVhZCwgY2FzZXMsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgU3dpdGNoQ2FzZSgpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgZXhwciA9IG51bGwsXG4gICAgICAgICAgICBsaXN0ID0gW10sXG4gICAgICAgICAgICB0eXBlO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsoKSA9PT0gXCJkZWZhdWx0XCIpIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKFwiY2FzZVwiKTtcbiAgICAgICAgICAgIGV4cHIgPSB0aGlzLkV4cHJlc3Npb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVhZChcIjpcIik7XG5cbiAgICAgICAgd2hpbGUgKHR5cGUgPSB0aGlzLnBlZWtVbnRpbChcIn1cIikpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IFwiY2FzZVwiIHx8IHR5cGUgPT09IFwiZGVmYXVsdFwiKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBsaXN0LnB1c2godGhpcy5EZWNsYXJhdGlvbihmYWxzZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuU3dpdGNoQ2FzZShleHByLCBsaXN0LCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIFRyeVN0YXRlbWVudCgpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpO1xuXG4gICAgICAgIHRoaXMucmVhZChcInRyeVwiKTtcblxuICAgICAgICBsZXQgdHJ5QmxvY2sgPSB0aGlzLkJsb2NrKCksXG4gICAgICAgICAgICBoYW5kbGVyID0gbnVsbCxcbiAgICAgICAgICAgIGZpbiA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMucGVlaygpID09PSBcImNhdGNoXCIpXG4gICAgICAgICAgICBoYW5kbGVyID0gdGhpcy5DYXRjaENsYXVzZSgpO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsoKSA9PT0gXCJmaW5hbGx5XCIpIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKFwiZmluYWxseVwiKTtcbiAgICAgICAgICAgIGZpbiA9IHRoaXMuQmxvY2soKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgQVNULlRyeVN0YXRlbWVudCh0cnlCbG9jaywgaGFuZGxlciwgZmluLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIENhdGNoQ2xhdXNlKCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiY2F0Y2hcIik7XG4gICAgICAgIHRoaXMucmVhZChcIihcIik7XG4gICAgICAgIGxldCBwYXJhbSA9IHRoaXMuQmluZGluZ1BhdHRlcm4oKTtcbiAgICAgICAgdGhpcy5yZWFkKFwiKVwiKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5DYXRjaENsYXVzZShwYXJhbSwgdGhpcy5CbG9jaygpLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIC8vID09PSBEZWNsYXJhdGlvbnMgPT09XG5cbiAgICBTdGF0ZW1lbnRMaXN0KHByb2xvZ3VlLCBpc01vZHVsZSkge1xuXG4gICAgICAgIGxldCBsaXN0ID0gW10sXG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgZXhwcixcbiAgICAgICAgICAgIGRpcjtcblxuICAgICAgICAvLyBUT0RPOiBpcyB0aGlzIHdyb25nIGZvciBicmFjZWxlc3Mgc3RhdGVtZW50IGxpc3RzP1xuICAgICAgICB3aGlsZSAodGhpcy5wZWVrVW50aWwoXCJ9XCIpKSB7XG5cbiAgICAgICAgICAgIG5vZGUgPSB0aGlzLkRlY2xhcmF0aW9uKGlzTW9kdWxlKTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGRpcmVjdGl2ZXNcbiAgICAgICAgICAgIGlmIChwcm9sb2d1ZSkge1xuXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gXCJFeHByZXNzaW9uU3RhdGVtZW50XCIgJiZcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5leHByZXNzaW9uLnR5cGUgPT09IFwiU3RyaW5nTGl0ZXJhbFwiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBub24tZXNjYXBlZCBsaXRlcmFsIHRleHQgb2YgdGhlIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICBleHByID0gbm9kZS5leHByZXNzaW9uO1xuICAgICAgICAgICAgICAgICAgICBkaXIgPSB0aGlzLmlucHV0LnNsaWNlKGV4cHIuc3RhcnQgKyAxLCBleHByLmVuZCAtIDEpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0RpcmVjdGl2ZShkaXIpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUgPSBuZXcgQVNULkRpcmVjdGl2ZShkaXIsIGV4cHIsIG5vZGUuc3RhcnQsIG5vZGUuZW5kKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHN0cmljdCBtb2RlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGlyID09PSBcInVzZSBzdHJpY3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFN0cmljdCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBwcm9sb2d1ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGlzdC5wdXNoKG5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgfVxuXG4gICAgRGVjbGFyYXRpb24oaXNNb2R1bGUpIHtcblxuICAgICAgICBzd2l0Y2ggKHRoaXMucGVlaygpKSB7XG5cbiAgICAgICAgICAgIGNhc2UgXCJmdW5jdGlvblwiOiByZXR1cm4gdGhpcy5GdW5jdGlvbkRlY2xhcmF0aW9uKCk7XG4gICAgICAgICAgICBjYXNlIFwiY2xhc3NcIjogcmV0dXJuIHRoaXMuQ2xhc3NEZWNsYXJhdGlvbigpO1xuICAgICAgICAgICAgY2FzZSBcImNvbnN0XCI6IHJldHVybiB0aGlzLkxleGljYWxEZWNsYXJhdGlvbigpO1xuXG4gICAgICAgICAgICBjYXNlIFwiaW1wb3J0XCI6XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNNb2R1bGUpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkltcG9ydERlY2xhcmF0aW9uKCk7XG5cbiAgICAgICAgICAgIGNhc2UgXCJleHBvcnRcIjpcblxuICAgICAgICAgICAgICAgIGlmIChpc01vZHVsZSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuRXhwb3J0RGVjbGFyYXRpb24oKTtcblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwiSURFTlRJRklFUlwiOlxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGVla0xldCgpKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5MZXhpY2FsRGVjbGFyYXRpb24oKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBlZWtGdW5jdGlvbk1vZGlmaWVyKCkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkZ1bmN0aW9uRGVjbGFyYXRpb24oKTtcblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuU3RhdGVtZW50KCk7XG4gICAgfVxuXG4gICAgTGV4aWNhbERlY2xhcmF0aW9uKCkge1xuXG4gICAgICAgIGxldCBub2RlID0gdGhpcy5WYXJpYWJsZURlY2xhcmF0aW9uKGZhbHNlKTtcblxuICAgICAgICB0aGlzLlNlbWljb2xvbigpO1xuICAgICAgICBub2RlLmVuZCA9IHRoaXMubm9kZUVuZCgpO1xuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIC8vID09PSBGdW5jdGlvbnMgPT09XG5cbiAgICBGdW5jdGlvbkRlY2xhcmF0aW9uKCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBraW5kID0gXCJcIixcbiAgICAgICAgICAgIHRvaztcblxuICAgICAgICB0b2sgPSB0aGlzLnBlZWtUb2tlbigpO1xuXG4gICAgICAgIGlmIChpc0Z1bmN0aW9uTW9kaWZpZXIoa2V5d29yZEZyb21Ub2tlbih0b2spKSkge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIGtpbmQgPSB0b2sudmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlYWQoXCJmdW5jdGlvblwiKTtcblxuICAgICAgICBpZiAoaXNHZW5lcmF0b3JNb2RpZmllcihraW5kKSAmJiB0aGlzLnBlZWsoKSA9PT0gXCIqXCIpIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICBraW5kID0ga2luZCA/IGtpbmQgKyBcIi1nZW5lcmF0b3JcIiA6IFwiZ2VuZXJhdG9yXCI7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnB1c2hDb250ZXh0KCk7XG4gICAgICAgIHRoaXMuc2V0RnVuY3Rpb25UeXBlKGtpbmQpO1xuXG4gICAgICAgIGxldCBpZGVudCA9IHRoaXMuQmluZGluZ0lkZW50aWZpZXIoKSxcbiAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMuRm9ybWFsUGFyYW1ldGVycygpLFxuICAgICAgICAgICAgYm9keSA9IHRoaXMuRnVuY3Rpb25Cb2R5KCk7XG5cbiAgICAgICAgdGhpcy5jaGVja1BhcmFtZXRlcnMocGFyYW1zKTtcbiAgICAgICAgdGhpcy5wb3BDb250ZXh0KCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuRnVuY3Rpb25EZWNsYXJhdGlvbihcbiAgICAgICAgICAgIGtpbmQsXG4gICAgICAgICAgICBpZGVudCxcbiAgICAgICAgICAgIHBhcmFtcyxcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBGdW5jdGlvbkV4cHJlc3Npb24oKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGlkZW50ID0gbnVsbCxcbiAgICAgICAgICAgIGtpbmQgPSBcIlwiLFxuICAgICAgICAgICAgdG9rO1xuXG4gICAgICAgIHRvayA9IHRoaXMucGVla1Rva2VuKCk7XG5cbiAgICAgICAgaWYgKGlzRnVuY3Rpb25Nb2RpZmllcihrZXl3b3JkRnJvbVRva2VuKHRvaykpKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAga2luZCA9IHRvay52YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVhZChcImZ1bmN0aW9uXCIpO1xuXG4gICAgICAgIGlmIChpc0dlbmVyYXRvck1vZGlmaWVyKGtpbmQpICYmIHRoaXMucGVlaygpID09PSBcIipcIikge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIGtpbmQgPSBraW5kID8ga2luZCArIFwiLWdlbmVyYXRvclwiIDogXCJnZW5lcmF0b3JcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHVzaENvbnRleHQoKTtcbiAgICAgICAgdGhpcy5zZXRGdW5jdGlvblR5cGUoa2luZCk7XG5cbiAgICAgICAgaWYgKHRoaXMucGVlaygpICE9PSBcIihcIilcbiAgICAgICAgICAgIGlkZW50ID0gdGhpcy5CaW5kaW5nSWRlbnRpZmllcigpO1xuXG4gICAgICAgIGxldCBwYXJhbXMgPSB0aGlzLkZvcm1hbFBhcmFtZXRlcnMoKSxcbiAgICAgICAgICAgIGJvZHkgPSB0aGlzLkZ1bmN0aW9uQm9keSgpO1xuXG4gICAgICAgIHRoaXMuY2hlY2tQYXJhbWV0ZXJzKHBhcmFtcyk7XG4gICAgICAgIHRoaXMucG9wQ29udGV4dCgpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkZ1bmN0aW9uRXhwcmVzc2lvbihcbiAgICAgICAgICAgIGtpbmQsXG4gICAgICAgICAgICBpZGVudCxcbiAgICAgICAgICAgIHBhcmFtcyxcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBNZXRob2REZWZpbml0aW9uKG5hbWUsIGNsYXNzRWxlbWVudCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IG5hbWUgPyBuYW1lLnN0YXJ0IDogdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGlzU3RhdGljID0gZmFsc2UsXG4gICAgICAgICAgICBraW5kID0gXCJcIixcbiAgICAgICAgICAgIHZhbDtcblxuICAgICAgICBpZiAoIW5hbWUgJiZcbiAgICAgICAgICAgIGNsYXNzRWxlbWVudCAmJlxuICAgICAgICAgICAgdGhpcy5wZWVrVG9rZW4oXCJuYW1lXCIpLnZhbHVlID09PSBcInN0YXRpY1wiICYmXG4gICAgICAgICAgICB0aGlzLnBlZWtBdChcIm5hbWVcIiwgMSkgIT09IFwiKFwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgaXNTdGF0aWMgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFuYW1lICYmIHRoaXMucGVlayhcIm5hbWVcIikgPT09IFwiKlwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuXG4gICAgICAgICAgICBraW5kID0gXCJnZW5lcmF0b3JcIjtcbiAgICAgICAgICAgIG5hbWUgPSB0aGlzLlByb3BlcnR5TmFtZSgpO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIGlmICghbmFtZSlcbiAgICAgICAgICAgICAgICBuYW1lID0gdGhpcy5Qcm9wZXJ0eU5hbWUoKTtcblxuICAgICAgICAgICAgdmFsID0ga2V5d29yZEZyb21Ob2RlKG5hbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5wZWVrKFwibmFtZVwiKSAhPT0gXCIoXCIpIHtcblxuICAgICAgICAgICAgICAgIGlmICh2YWwgPT09IFwiZ2V0XCIgfHwgdmFsID09PSBcInNldFwiIHx8IGlzRnVuY3Rpb25Nb2RpZmllcih2YWwpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAga2luZCA9IG5hbWUudmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzR2VuZXJhdG9yTW9kaWZpZXIoa2luZCkgJiYgdGhpcy5wZWVrKFwibmFtZVwiKSA9PT0gXCIqXCIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBraW5kICs9IFwiLWdlbmVyYXRvclwiO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbmFtZSA9IHRoaXMuUHJvcGVydHlOYW1lKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNsYXNzRWxlbWVudCkge1xuXG4gICAgICAgICAgICBpZiAoaXNTdGF0aWMpIHtcblxuICAgICAgICAgICAgICAgIGlmIChuYW1lLnR5cGUgPT09IFwiSWRlbnRpZmllclwiICYmIG5hbWUudmFsdWUgPT09IFwicHJvdG90eXBlXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbChcIkludmFsaWQgcHJvdG90eXBlIHByb3BlcnR5IGluIGNsYXNzIGRlZmluaXRpb25cIiwgbmFtZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAobmFtZS50eXBlID09PSBcIklkZW50aWZpZXJcIiAmJiBuYW1lLnZhbHVlID09PSBcImNvbnN0cnVjdG9yXCIpIHtcblxuICAgICAgICAgICAgICAgIGlmIChraW5kICE9PSBcIlwiKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIGNvbnN0cnVjdG9yIHByb3BlcnR5IGluIGNsYXNzIGRlZmluaXRpb25cIiwgbmFtZSk7XG5cbiAgICAgICAgICAgICAgICBraW5kID0gXCJjb25zdHJ1Y3RvclwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wdXNoQ29udGV4dCgpO1xuICAgICAgICB0aGlzLnNldEZ1bmN0aW9uVHlwZShraW5kKTtcbiAgICAgICAgdGhpcy5jb250ZXh0LmlzTWV0aG9kID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jb250ZXh0LmlzQ29uc3RydWN0b3IgPSBraW5kID09PSBcImNvbnN0cnVjdG9yXCI7XG5cbiAgICAgICAgbGV0IHBhcmFtcyA9IGtpbmQgPT09IFwiZ2V0XCIgfHwga2luZCA9PT0gXCJzZXRcIiA/XG4gICAgICAgICAgICB0aGlzLkFjY2Vzc29yUGFyYW1ldGVycyhraW5kKSA6XG4gICAgICAgICAgICB0aGlzLkZvcm1hbFBhcmFtZXRlcnMoKTtcblxuICAgICAgICBsZXQgYm9keSA9IHRoaXMuRnVuY3Rpb25Cb2R5KCk7XG5cbiAgICAgICAgdGhpcy5jaGVja1BhcmFtZXRlcnMocGFyYW1zKTtcbiAgICAgICAgdGhpcy5wb3BDb250ZXh0KCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuTWV0aG9kRGVmaW5pdGlvbihcbiAgICAgICAgICAgIGlzU3RhdGljLFxuICAgICAgICAgICAga2luZCxcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBwYXJhbXMsXG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgQWNjZXNzb3JQYXJhbWV0ZXJzKGtpbmQpIHtcblxuICAgICAgICBsZXQgbGlzdCA9IFtdO1xuXG4gICAgICAgIHRoaXMucmVhZChcIihcIik7XG5cbiAgICAgICAgaWYgKGtpbmQgPT09IFwic2V0XCIpXG4gICAgICAgICAgICBsaXN0LnB1c2godGhpcy5Gb3JtYWxQYXJhbWV0ZXIoZmFsc2UpKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCIpXCIpO1xuXG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgIH1cblxuICAgIEZvcm1hbFBhcmFtZXRlcnMoKSB7XG5cbiAgICAgICAgbGV0IGxpc3QgPSBbXTtcblxuICAgICAgICB0aGlzLnJlYWQoXCIoXCIpO1xuXG4gICAgICAgIHdoaWxlICh0aGlzLnBlZWtVbnRpbChcIilcIikpIHtcblxuICAgICAgICAgICAgaWYgKGxpc3QubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWQoXCIsXCIpO1xuXG4gICAgICAgICAgICAvLyBQYXJhbWV0ZXIgbGlzdCBtYXkgaGF2ZSBhIHRyYWlsaW5nIHJlc3QgcGFyYW1ldGVyXG4gICAgICAgICAgICBpZiAodGhpcy5wZWVrKCkgPT09IFwiLi4uXCIpIHtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaCh0aGlzLlJlc3RQYXJhbWV0ZXIoKSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxpc3QucHVzaCh0aGlzLkZvcm1hbFBhcmFtZXRlcih0cnVlKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlYWQoXCIpXCIpO1xuXG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgIH1cblxuICAgIEZvcm1hbFBhcmFtZXRlcihhbGxvd0RlZmF1bHQpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgcGF0dGVybiA9IHRoaXMuQmluZGluZ1BhdHRlcm4oKSxcbiAgICAgICAgICAgIGluaXQgPSBudWxsO1xuXG4gICAgICAgIGlmIChhbGxvd0RlZmF1bHQgJiYgdGhpcy5wZWVrKCkgPT09IFwiPVwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgaW5pdCA9IHRoaXMuQXNzaWdubWVudEV4cHJlc3Npb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkZvcm1hbFBhcmFtZXRlcihwYXR0ZXJuLCBpbml0LCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIFJlc3RQYXJhbWV0ZXIoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKTtcblxuICAgICAgICB0aGlzLnJlYWQoXCIuLi5cIik7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuUmVzdFBhcmFtZXRlcih0aGlzLkJpbmRpbmdJZGVudGlmaWVyKCksIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgRnVuY3Rpb25Cb2R5KCkge1xuXG4gICAgICAgIHRoaXMuY29udGV4dC5mdW5jdGlvbkJvZHkgPSB0cnVlO1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwie1wiKTtcbiAgICAgICAgbGV0IHN0YXRlbWVudHMgPSB0aGlzLlN0YXRlbWVudExpc3QodHJ1ZSwgZmFsc2UpO1xuICAgICAgICB0aGlzLnJlYWQoXCJ9XCIpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkZ1bmN0aW9uQm9keShzdGF0ZW1lbnRzLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIEFycm93RnVuY3Rpb25IZWFkKGtpbmQsIGZvcm1hbHMsIHN0YXJ0KSB7XG5cbiAgICAgICAgLy8gQ29udGV4dCBtdXN0IGhhdmUgYmVlbiBwdXNoZWQgYnkgY2FsbGVyXG4gICAgICAgIHRoaXMuc2V0RnVuY3Rpb25UeXBlKGtpbmQpO1xuXG4gICAgICAgIGlmICh0aGlzLmNvbnRleHQuaGFzWWllbGRBd2FpdClcbiAgICAgICAgICAgIHRoaXMuZmFpbChcIkludmFsaWQgeWllbGQgb3IgYXdhaXQgd2l0aGluIGFycm93IGZ1bmN0aW9uIGhlYWRcIik7XG5cbiAgICAgICAgLy8gVHJhbnNmb3JtIGFuZCB2YWxpZGF0ZSBmb3JtYWwgcGFyYW1ldGVyc1xuICAgICAgICBsZXQgcGFyYW1zID0gdGhpcy5jaGVja0Fycm93UGFyYW1ldGVycyhmb3JtYWxzKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5BcnJvd0Z1bmN0aW9uSGVhZChwYXJhbXMsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgQXJyb3dGdW5jdGlvbkJvZHkoaGVhZCwgbm9Jbikge1xuXG4gICAgICAgIHRoaXMucmVhZChcIj0+XCIpO1xuXG4gICAgICAgIGxldCBwYXJhbXMgPSBoZWFkLnBhcmFtZXRlcnMsXG4gICAgICAgICAgICBzdGFydCA9IGhlYWQuc3RhcnQsXG4gICAgICAgICAgICBraW5kID0gdGhpcy5jb250ZXh0LmlzQXN5bmMgPyBcImFzeW5jXCIgOiBcIlwiO1xuXG4gICAgICAgIC8vIFVzZSBmdW5jdGlvbiBib2R5IGNvbnRleHQgZXZlbiBpZiBwYXJzaW5nIGV4cHJlc3Npb24gYm9keSBmb3JtXG4gICAgICAgIHRoaXMuY29udGV4dC5mdW5jdGlvbkJvZHkgPSB0cnVlO1xuXG4gICAgICAgIGxldCBib2R5ID0gdGhpcy5wZWVrKCkgPT09IFwie1wiID9cbiAgICAgICAgICAgIHRoaXMuRnVuY3Rpb25Cb2R5KCkgOlxuICAgICAgICAgICAgdGhpcy5Bc3NpZ25tZW50RXhwcmVzc2lvbihub0luKTtcblxuICAgICAgICB0aGlzLnBvcENvbnRleHQoKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5BcnJvd0Z1bmN0aW9uKGtpbmQsIHBhcmFtcywgYm9keSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICAvLyA9PT0gQ2xhc3NlcyA9PT1cblxuICAgIENsYXNzRGVjbGFyYXRpb24oKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGlkZW50ID0gbnVsbCxcbiAgICAgICAgICAgIGJhc2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVhZChcImNsYXNzXCIpO1xuXG4gICAgICAgIGlkZW50ID0gdGhpcy5CaW5kaW5nSWRlbnRpZmllcigpO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsoKSA9PT0gXCJleHRlbmRzXCIpIHtcblxuICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICBiYXNlID0gdGhpcy5NZW1iZXJFeHByZXNzaW9uKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuQ2xhc3NEZWNsYXJhdGlvbihcbiAgICAgICAgICAgIGlkZW50LFxuICAgICAgICAgICAgYmFzZSxcbiAgICAgICAgICAgIHRoaXMuQ2xhc3NCb2R5KCksXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBDbGFzc0V4cHJlc3Npb24oKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGlkZW50ID0gbnVsbCxcbiAgICAgICAgICAgIGJhc2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVhZChcImNsYXNzXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsoKSA9PT0gXCJJREVOVElGSUVSXCIpXG4gICAgICAgICAgICBpZGVudCA9IHRoaXMuQmluZGluZ0lkZW50aWZpZXIoKTtcblxuICAgICAgICBpZiAodGhpcy5wZWVrKCkgPT09IFwiZXh0ZW5kc1wiKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgYmFzZSA9IHRoaXMuTWVtYmVyRXhwcmVzc2lvbih0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgQVNULkNsYXNzRXhwcmVzc2lvbihcbiAgICAgICAgICAgIGlkZW50LFxuICAgICAgICAgICAgYmFzZSxcbiAgICAgICAgICAgIHRoaXMuQ2xhc3NCb2R5KCksXG4gICAgICAgICAgICBzdGFydCxcbiAgICAgICAgICAgIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBDbGFzc0JvZHkoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGhhc0NvbnN0cnVjdG9yID0gZmFsc2UsXG4gICAgICAgICAgICBsaXN0ID0gW107XG5cbiAgICAgICAgdGhpcy5wdXNoQ29udGV4dCgpO1xuICAgICAgICB0aGlzLnNldFN0cmljdCh0cnVlKTtcbiAgICAgICAgdGhpcy5yZWFkKFwie1wiKTtcblxuICAgICAgICB3aGlsZSAodGhpcy5wZWVrVW50aWwoXCJ9XCIsIFwibmFtZVwiKSkge1xuXG4gICAgICAgICAgICBsZXQgZWxlbSA9IHRoaXMuQ2xhc3NFbGVtZW50KCk7XG5cbiAgICAgICAgICAgIGlmIChlbGVtLnR5cGUgPT09IFwiTWV0aG9kRGVmaW5pdGlvblwiICYmIGVsZW0ua2luZCA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoaGFzQ29uc3RydWN0b3IpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbChcIkR1cGxpY2F0ZSBjb25zdHJ1Y3RvciBkZWZpbml0aW9uc1wiLCBlbGVtLm5hbWUpO1xuXG4gICAgICAgICAgICAgICAgaGFzQ29uc3RydWN0b3IgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsaXN0LnB1c2goZWxlbSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlYWQoXCJ9XCIpO1xuICAgICAgICB0aGlzLnBvcENvbnRleHQoKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5DbGFzc0JvZHkobGlzdCwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBQcml2YXRlRGVjbGFyYXRpb24oKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIG5hbWUgPSB0aGlzLkF0TmFtZSgpLFxuICAgICAgICAgICAgaW5pdCA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMucGVlaygpID09PSBcIj1cIikge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIGluaXQgPSB0aGlzLkFzc2lnbm1lbnRFeHByZXNzaW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLlNlbWljb2xvbigpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULlByaXZhdGVEZWNsYXJhdGlvbihuYW1lLCBpbml0LCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIEVtcHR5Q2xhc3NFbGVtZW50KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCk7XG5cbiAgICAgICAgdGhpcy5yZWFkKFwiO1wiKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5FbXB0eUNsYXNzRWxlbWVudChzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIENsYXNzRWxlbWVudCgpIHtcblxuICAgICAgICBsZXQgbmV4dCA9IHRoaXMucGVla1Rva2VuKFwibmFtZVwiKTtcblxuICAgICAgICBpZiAobmV4dC50eXBlID09PSBcIjtcIilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVtcHR5Q2xhc3NFbGVtZW50KCk7XG5cbiAgICAgICAgaWYgKG5leHQudHlwZSA9PT0gXCJBVE5BTUVcIilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLlByaXZhdGVEZWNsYXJhdGlvbigpO1xuXG4gICAgICAgIGlmIChuZXh0LnR5cGUgPT09IFwiSURFTlRJRklFUlwiICYmXG4gICAgICAgICAgICAhaXNNZXRob2RLZXl3b3JkKG5leHQudmFsdWUpICYmXG4gICAgICAgICAgICB0aGlzLnBlZWtBdChcIm5hbWVcIiwgMSkgIT09IFwiKFwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMudW5wZWVrKCk7XG5cbiAgICAgICAgICAgIHN3aXRjaCAodGhpcy5wZWVrKCkpIHtcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc1wiOiByZXR1cm4gdGhpcy5DbGFzc0RlY2xhcmF0aW9uKCk7XG4gICAgICAgICAgICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiB0aGlzLkZ1bmN0aW9uRGVjbGFyYXRpb24oKTtcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJ2YXJcIjpcbiAgICAgICAgICAgICAgICBjYXNlIFwiY29uc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuTGV4aWNhbERlY2xhcmF0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiSURFTlRJRklFUlwiOlxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBlZWtMZXQoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLkxleGljYWxEZWNsYXJhdGlvbigpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBlZWtGdW5jdGlvbk1vZGlmaWVyKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5GdW5jdGlvbkRlY2xhcmF0aW9uKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudW5wZWVrKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5NZXRob2REZWZpbml0aW9uKG51bGwsIHRydWUpO1xuICAgIH1cblxuICAgIC8vID09PSBNb2R1bGVzID09PVxuXG4gICAgSW1wb3J0RGVjbGFyYXRpb24oKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGltcG9ydHMgPSBudWxsLFxuICAgICAgICAgICAgZnJvbTtcblxuICAgICAgICB0aGlzLnJlYWQoXCJpbXBvcnRcIik7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLnBlZWsoKSkge1xuXG4gICAgICAgICAgICBjYXNlIFwiKlwiOlxuICAgICAgICAgICAgICAgIGltcG9ydHMgPSB0aGlzLk5hbWVzcGFjZUltcG9ydCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwie1wiOlxuICAgICAgICAgICAgICAgIGltcG9ydHMgPSB0aGlzLk5hbWVkSW1wb3J0cygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwiU1RSSU5HXCI6XG4gICAgICAgICAgICAgICAgZnJvbSA9IHRoaXMuU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGltcG9ydHMgPSB0aGlzLkRlZmF1bHRJbXBvcnQoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZnJvbSkge1xuXG4gICAgICAgICAgICB0aGlzLnJlYWRLZXl3b3JkKFwiZnJvbVwiKTtcbiAgICAgICAgICAgIGZyb20gPSB0aGlzLlN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuU2VtaWNvbG9uKCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuSW1wb3J0RGVjbGFyYXRpb24oaW1wb3J0cywgZnJvbSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBEZWZhdWx0SW1wb3J0KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBpZGVudCA9IHRoaXMuQmluZGluZ0lkZW50aWZpZXIoKSxcbiAgICAgICAgICAgIGV4dHJhID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5wZWVrKCkgPT09IFwiLFwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMucGVlaygpKSB7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiKlwiOlxuICAgICAgICAgICAgICAgICAgICBleHRyYSA9IHRoaXMuTmFtZXNwYWNlSW1wb3J0KCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIntcIjpcbiAgICAgICAgICAgICAgICAgICAgZXh0cmEgPSB0aGlzLk5hbWVkSW1wb3J0cygpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuRGVmYXVsdEltcG9ydChpZGVudCwgZXh0cmEsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG4gICAgTmFtZXNwYWNlSW1wb3J0KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBpZGVudDtcblxuICAgICAgICB0aGlzLnJlYWQoXCIqXCIpO1xuICAgICAgICB0aGlzLnJlYWRLZXl3b3JkKFwiYXNcIik7XG4gICAgICAgIGlkZW50ID0gdGhpcy5CaW5kaW5nSWRlbnRpZmllcigpO1xuXG4gICAgICAgIHJldHVybiBuZXcgQVNULk5hbWVzcGFjZUltcG9ydChpZGVudCwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBOYW1lZEltcG9ydHMoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGxpc3QgPSBbXTtcblxuICAgICAgICB0aGlzLnJlYWQoXCJ7XCIpO1xuXG4gICAgICAgIHdoaWxlICh0aGlzLnBlZWtVbnRpbChcIn1cIikpIHtcblxuICAgICAgICAgICAgbGlzdC5wdXNoKHRoaXMuSW1wb3J0U3BlY2lmaWVyKCkpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5wZWVrKCkgPT09IFwiLFwiKVxuICAgICAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZWFkKFwifVwiKTtcblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5OYW1lZEltcG9ydHMobGlzdCwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBJbXBvcnRTcGVjaWZpZXIoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGhhc0xvY2FsID0gZmFsc2UsXG4gICAgICAgICAgICBsb2NhbCA9IG51bGwsXG4gICAgICAgICAgICByZW1vdGU7XG5cbiAgICAgICAgaWYgKHRoaXMucGVlaygpICE9PSBcIklERU5USUZJRVJcIikge1xuXG4gICAgICAgICAgICAvLyBSZS1zY2FuIHRva2VuIGFzIGFuIGlkZW50aWZpZXIgbmFtZVxuICAgICAgICAgICAgdGhpcy51bnBlZWsoKTtcbiAgICAgICAgICAgIHJlbW90ZSA9IHRoaXMuSWRlbnRpZmllck5hbWUoKTtcbiAgICAgICAgICAgIGhhc0xvY2FsID0gdHJ1ZTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICByZW1vdGUgPSB0aGlzLklkZW50aWZpZXIoKTtcbiAgICAgICAgICAgIGhhc0xvY2FsID0gdGhpcy5wZWVrS2V5d29yZChcImFzXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc0xvY2FsKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZEtleXdvcmQoXCJhc1wiKTtcbiAgICAgICAgICAgIGxvY2FsID0gdGhpcy5CaW5kaW5nSWRlbnRpZmllcigpO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIHRoaXMuY2hlY2tCaW5kaW5nVGFyZ2V0KHJlbW90ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5JbXBvcnRTcGVjaWZpZXIocmVtb3RlLCBsb2NhbCwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBFeHBvcnREZWNsYXJhdGlvbigpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgZXhwb3J0cztcblxuICAgICAgICB0aGlzLnJlYWQoXCJleHBvcnRcIik7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLnBlZWsoKSkge1xuXG4gICAgICAgICAgICBjYXNlIFwidmFyXCI6XG4gICAgICAgICAgICBjYXNlIFwiY29uc3RcIjpcbiAgICAgICAgICAgICAgICBleHBvcnRzID0gdGhpcy5MZXhpY2FsRGVjbGFyYXRpb24oKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgICAgICAgICAgZXhwb3J0cyA9IHRoaXMuRnVuY3Rpb25EZWNsYXJhdGlvbigpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwiY2xhc3NcIjpcbiAgICAgICAgICAgICAgICBleHBvcnRzID0gdGhpcy5DbGFzc0RlY2xhcmF0aW9uKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJkZWZhdWx0XCI6XG4gICAgICAgICAgICAgICAgZXhwb3J0cyA9IHRoaXMuRGVmYXVsdEV4cG9ydCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwiSURFTlRJRklFUlwiOlxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGVla0xldCgpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgZXhwb3J0cyA9IHRoaXMuTGV4aWNhbERlY2xhcmF0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBlZWtGdW5jdGlvbk1vZGlmaWVyKCkpIHtcblxuICAgICAgICAgICAgICAgICAgICBleHBvcnRzID0gdGhpcy5GdW5jdGlvbkRlY2xhcmF0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBleHBvcnRzID0gdGhpcy5FeHBvcnRDbGF1c2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLlNlbWljb2xvbigpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuRXhwb3J0RGVjbGFyYXRpb24oZXhwb3J0cywgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBEZWZhdWx0RXhwb3J0KCkge1xuXG4gICAgICAgIGxldCBzdGFydCA9IHRoaXMubm9kZVN0YXJ0KCksXG4gICAgICAgICAgICBiaW5kaW5nO1xuXG4gICAgICAgIHRoaXMucmVhZChcImRlZmF1bHRcIik7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLnBlZWsoKSkge1xuXG4gICAgICAgICAgICBjYXNlIFwiY2xhc3NcIjpcbiAgICAgICAgICAgICAgICBiaW5kaW5nID0gdGhpcy5DbGFzc0V4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuRnVuY3Rpb25FeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJJREVOVElGSUVSXCI6XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wZWVrRnVuY3Rpb25Nb2RpZmllcigpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuRnVuY3Rpb25FeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBiaW5kaW5nID0gdGhpcy5Bc3NpZ25tZW50RXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGlzRGVjbCA9IHRoaXMudHJhbnNmb3JtRGVmYXVsdEV4cG9ydChiaW5kaW5nKTtcblxuICAgICAgICBpZiAoIWlzRGVjbClcbiAgICAgICAgICAgIHRoaXMuU2VtaWNvbG9uKCk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuRGVmYXVsdEV4cG9ydChiaW5kaW5nLCBzdGFydCwgdGhpcy5ub2RlRW5kKCkpO1xuICAgIH1cblxuICAgIEV4cG9ydENsYXVzZSgpIHtcblxuICAgICAgICBsZXQgc3RhcnQgPSB0aGlzLm5vZGVTdGFydCgpLFxuICAgICAgICAgICAgbGlzdCA9IG51bGwsXG4gICAgICAgICAgICBmcm9tID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5wZWVrKCkgPT09IFwiKlwiKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgdGhpcy5yZWFkS2V5d29yZChcImZyb21cIik7XG4gICAgICAgICAgICBmcm9tID0gdGhpcy5TdHJpbmdMaXRlcmFsKCk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgbGlzdCA9IFtdO1xuXG4gICAgICAgICAgICB0aGlzLnJlYWQoXCJ7XCIpO1xuXG4gICAgICAgICAgICB3aGlsZSAodGhpcy5wZWVrVW50aWwoXCJ9XCIsIFwibmFtZVwiKSkge1xuXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKHRoaXMuRXhwb3J0U3BlY2lmaWVyKCkpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGVlaygpID09PSBcIixcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucmVhZChcIn1cIik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnBlZWtLZXl3b3JkKFwiZnJvbVwiKSkge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkKCk7XG4gICAgICAgICAgICAgICAgZnJvbSA9IHRoaXMuU3RyaW5nTGl0ZXJhbCgpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gVHJhbnNmb3JtIGlkZW50aWZpZXIgbmFtZXMgdG8gaWRlbnRpZmllcnNcbiAgICAgICAgICAgICAgICBsaXN0LmZvckVhY2gobm9kZSA9PiB0aGlzLnRyYW5zZm9ybUlkZW50aWZpZXIobm9kZS5sb2NhbCkpO1xuICAgICAgICAgICAgfVxuICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IEFTVC5FeHBvcnRDbGF1c2UobGlzdCwgZnJvbSwgc3RhcnQsIHRoaXMubm9kZUVuZCgpKTtcbiAgICB9XG5cbiAgICBFeHBvcnRTcGVjaWZpZXIoKSB7XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5ub2RlU3RhcnQoKSxcbiAgICAgICAgICAgIGxvY2FsID0gdGhpcy5JZGVudGlmaWVyTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3RlID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5wZWVrS2V5d29yZChcImFzXCIpKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgcmVtb3RlID0gdGhpcy5JZGVudGlmaWVyTmFtZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBBU1QuRXhwb3J0U3BlY2lmaWVyKGxvY2FsLCByZW1vdGUsIHN0YXJ0LCB0aGlzLm5vZGVFbmQoKSk7XG4gICAgfVxuXG59XG5cbmZ1bmN0aW9uIG1peGluKHRhcmdldCwgLi4uc291cmNlcykge1xuXG4gICAgdGFyZ2V0ID0gdGFyZ2V0LnByb3RvdHlwZTtcblxuICAgIGxldCB7XG4gICAgICAgIGdldE93blByb3BlcnR5TmFtZXM6IG93bk5hbWVzLFxuICAgICAgICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I6IG93bkRlc2MsXG4gICAgICAgIHByb3RvdHlwZTogeyBoYXNPd25Qcm9wZXJ0eTogaGFzT3duIH0gfSA9IE9iamVjdDtcblxuICAgIHNvdXJjZXNcbiAgICAubWFwKHNvdXJjZSA9PiBzb3VyY2UucHJvdG90eXBlKVxuICAgIC5mb3JFYWNoKHNvdXJjZSA9PlxuICAgICAgICBvd25OYW1lcyhzb3VyY2UpXG4gICAgICAgIC5maWx0ZXIoa2V5ID0+ICFoYXNPd24uY2FsbCh0YXJnZXQsIGtleSkpXG4gICAgICAgIC5mb3JFYWNoKGtleSA9PiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIG93bkRlc2Moc291cmNlLCBrZXkpKSkpO1xufVxuXG4vLyBBZGQgZXh0ZXJuYWxseSBkZWZpbmVkIG1ldGhvZHNcbm1peGluKFBhcnNlciwgVHJhbnNmb3JtLCBWYWxpZGF0ZSk7XG4iXX0=
