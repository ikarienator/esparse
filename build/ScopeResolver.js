"use strict";

// istanbul ignore next
var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

// istanbul ignore next
var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// TODO:  How we deal with the insanity that is with statements?
// TODO:  Param scopes have empty free lists, which is strange

var Scope = (function () {
    function Scope(type) {
        _classCallCheck(this, Scope);

        this.type = type || "block";
        this.names = Object.create(null);
        this.free = [];
        this.strict = false;
        this.parent = null;
        this.children = [];
        this.varNames = [];
    }

    _prototypeProperties(Scope, null, {
        resolveName: {
            value: function resolveName(name) {
                if (this.names[name]) {
                    return this.names[name];
                }if (this.parent) {
                    return this.parent.resolveName(name);
                }return null;
            },
            writable: true,
            configurable: true
        }
    });

    return Scope;
})();

var ScopeResolver = exports.ScopeResolver = (function () {
    function ScopeResolver() {
        _classCallCheck(this, ScopeResolver);
    }

    _prototypeProperties(ScopeResolver, null, {
        resolve: {
            value: function resolve(parseResult) {
                this.parseResult = parseResult;
                this.stack = [];
                this.top = new Scope("var");

                this.visit(parseResult.ast);
                this.flushFree();

                parseResult.scopeTree = this.top;
            },
            writable: true,
            configurable: true
        },
        fail: {
            value: function fail(msg, node) {
                throw this.parseResult.createSyntaxError(msg, node);
            },
            writable: true,
            configurable: true
        },
        pushScope: {
            value: function pushScope(type) {
                var strict = this.top.strict;
                this.stack.push(this.top);
                this.top = new Scope(type);
                this.top.strict = strict;

                return this.top;
            },
            writable: true,
            configurable: true
        },
        flushFree: {
            value: function flushFree() {
                var map = this.top.names,
                    free = this.top.free,
                    next = null,
                    freeList = [];

                if (this.stack.length > 0) next = this.stack[this.stack.length - 1];

                this.top.free = freeList;

                free.forEach(function (r) {
                    var name = r.value;

                    if (map[name]) {
                        map[name].references.push(r);
                    } else {
                        freeList.push(r);

                        if (next) next.free.push(r);
                    }
                });
            },
            writable: true,
            configurable: true
        },
        linkScope: {
            value: function linkScope(child) {
                var p = this.top;
                child.parent = p;
                p.children.push(child);
            },
            writable: true,
            configurable: true
        },
        popScope: {
            value: function popScope() {
                var _this = this;


                var scope = this.top,
                    varNames = scope.varNames,
                    free = scope.free;

                scope.varNames = null;

                this.flushFree();
                this.top = this.stack.pop();
                this.linkScope(scope);

                varNames.forEach(function (n) {
                    if (scope.names[n.value]) _this.fail("Cannot shadow lexical declaration with var", n);else if (_this.top.type === "var") _this.addName(n, "var");else _this.top.varNames.push(n);
                });
            },
            writable: true,
            configurable: true
        },
        visit: {
            value: function visit(node, kind) {
                var _this = this;


                if (!node) {
                    return;
                }var f = this[node.type];

                if (typeof f === "function") f.call(this, node, kind);else node.children().forEach(function (n) {
                    return _this.visit(n, kind);
                });
            },
            writable: true,
            configurable: true
        },
        hasStrictDirective: {
            value: function hasStrictDirective(statements) {
                for (var i = 0; i < statements.length; ++i) {
                    var n = statements[i];

                    if (n.type !== "Directive") break;

                    if (n.value === "use strict") {
                        return true;
                    }
                }

                return false;
            },
            writable: true,
            configurable: true
        },
        visitFunction: {
            value: function visitFunction(params, body, strictParams) {
                var _this = this;


                var paramScope = this.pushScope("param");

                if (!this.top.strict && body.statements && this.hasStrictDirective(body.statements)) {
                    this.top.strict = true;
                }

                strictParams = strictParams || this.top.strict;

                params.forEach(function (n) {
                    if (!strictParams && (n.type !== "FormalParameter" || n.initializer || n.pattern.type !== "Identifier")) {
                        strictParams = true;
                    }

                    _this.visit(n, "param");
                    _this.flushFree();
                    _this.top.free.length = 0;
                });

                this.pushScope("var");
                var blockScope = this.pushScope("block");
                this.visit(body, "var");
                this.popScope();
                this.popScope();

                this.popScope();

                Object.keys(paramScope.names).forEach(function (name) {
                    if (blockScope.names[name]) _this.fail("Duplicate block declaration", blockScope.names[name].declarations[0]);

                    if (strictParams && paramScope.names[name].declarations.length > 1) _this.fail("Duplicate parameter names", paramScope.names[name].declarations[1]);
                });
            },
            writable: true,
            configurable: true
        },
        addReference: {
            value: function addReference(node) {
                var name = node.value,
                    map = this.top.names,
                    next = this.stack[this.stack.length - 1];

                if (map[name]) map[name].references.push(node);else top.free.push(node);
            },
            writable: true,
            configurable: true
        },
        addName: {
            value: function addName(node, kind) {
                var name = node.value,
                    map = this.top.names,
                    record = map[name];

                if (record) {
                    if (kind !== "var" && kind !== "param") this.fail("Duplicate variable declaration", node);
                } else {
                    if (name === "let" && (kind === "let" || kind === "const")) this.fail("Invalid binding identifier", node);

                    map[name] = record = { declarations: [], references: [] };
                }

                record.declarations.push(node);
            },
            writable: true,
            configurable: true
        },
        Script: {
            value: function Script(node) {
                var _this = this;


                this.pushScope("block");

                if (this.hasStrictDirective(node.statements)) this.top.strict = true;

                node.children().forEach(function (n) {
                    return _this.visit(n, "var");
                });

                this.popScope();
            },
            writable: true,
            configurable: true
        },
        Module: {
            value: function Module(node) {
                var _this = this;


                this.pushScope("block");
                this.top.strict = true;
                node.children().forEach(function (n) {
                    return _this.visit(n, "var");
                });
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        Block: {
            value: function Block(node) {
                var _this = this;


                this.pushScope("block");
                node.children().forEach(function (n) {
                    return _this.visit(n);
                });
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        SwitchStatement: {
            value: function SwitchStatement(node) {
                this.Block(node);
            },
            writable: true,
            configurable: true
        },
        ForOfStatement: {
            value: function ForOfStatement(node) {
                this.ForStatement(node);
            },
            writable: true,
            configurable: true
        },
        ForInStatement: {
            value: function ForInStatement(node) {
                this.ForStatement(node);
            },
            writable: true,
            configurable: true
        },
        ForStatement: {
            value: function ForStatement(node) {
                var _this = this;


                this.pushScope("for");
                node.children().forEach(function (n) {
                    return _this.visit(n);
                });
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        CatchClause: {
            value: function CatchClause(node) {
                var _this = this;


                this.pushScope("catch");
                this.visit(node.param);
                node.body.children().forEach(function (n) {
                    return _this.visit(n);
                });
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        VariableDeclaration: {
            value: function VariableDeclaration(node) {
                var _this = this;


                node.children().forEach(function (n) {
                    return _this.visit(n, node.kind);
                });
            },
            writable: true,
            configurable: true
        },
        FunctionDeclaration: {
            value: function FunctionDeclaration(node, kind) {
                this.visit(node.identifier, kind);
                this.pushScope("function");
                this.visitFunction(node.params, node.body, false);
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        FunctionExpression: {
            value: function FunctionExpression(node) {
                this.pushScope("function");
                this.visit(node.identifier);
                this.visitFunction(node.params, node.body, false);
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        MethodDefinition: {
            value: function MethodDefinition(node) {
                this.pushScope("function");
                this.visitFunction(node.params, node.body, true);
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        ArrowFunction: {
            value: function ArrowFunction(node) {
                this.pushScope("function");
                this.visitFunction(node.params, node.body, true);
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        ClassDeclaration: {
            value: function ClassDeclaration(node) {
                this.visit(node.identifier, "let");
                this.pushScope("class");
                this.top.strict = true;
                this.visit(node.base);
                this.visit(node.body);
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        ClassExpression: {
            value: function ClassExpression(node) {
                this.pushScope("class");
                this.top.strict = true;
                this.visit(node.identifier);
                this.visit(node.base);
                this.visit(node.body);
                this.popScope();
            },
            writable: true,
            configurable: true
        },
        Identifier: {
            value: function Identifier(node, kind) {
                switch (node.context) {

                    case "variable":
                        this.top.free.push(node);
                        break;

                    case "declaration":
                        if (kind === "var" && this.top.type !== "var") this.top.varNames.push(node);else this.addName(node, kind);
                        break;
                }
            },
            writable: true,
            configurable: true
        }
    });

    return ScopeResolver;
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9TY29wZVJlc29sdmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0lBR00sS0FBSztBQUVJLGFBRlQsS0FBSyxDQUVLLElBQUk7OEJBRmQsS0FBSzs7QUFJSCxZQUFJLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxPQUFPLENBQUM7QUFDNUIsWUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pDLFlBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2YsWUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7QUFDcEIsWUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7QUFDbkIsWUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDbkIsWUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7S0FDdEI7O3lCQVhDLEtBQUs7QUFhUCxtQkFBVzttQkFBQSxxQkFBQyxJQUFJLEVBQUU7QUFFZCxvQkFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztBQUNoQiwyQkFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUFBLEFBRTVCLElBQUksSUFBSSxDQUFDLE1BQU07QUFDWCwyQkFBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFBQSxBQUV6QyxPQUFPLElBQUksQ0FBQzthQUNmOzs7Ozs7V0F0QkMsS0FBSzs7O0lBeUJFLGFBQWEsV0FBYixhQUFhO2FBQWIsYUFBYTs4QkFBYixhQUFhOzs7eUJBQWIsYUFBYTtBQUV0QixlQUFPO21CQUFBLGlCQUFDLFdBQVcsRUFBRTtBQUVqQixvQkFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7QUFDL0Isb0JBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ2hCLG9CQUFJLENBQUMsR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLEtB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b0JBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzVCLG9CQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN0QixvQkFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdEIsb0JBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQzthQUNuQjs7OztBQUVELGtCQUFVO21CQUFBLG9CQUFDLElBQUksRUFBRSxJQUFJLEVBQUU7QUFFbkIsd0JBQVEsSUFBSSxDQUFDLE9BQU87O0FBRWhCLHlCQUFLLFVBQVU7QUFDWCw0QkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3pCLDhCQUFNOztBQUFBLEFBRVYseUJBQUssYUFBYTtBQUNkLDRCQUFJLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssS0FBSyxFQUN6QyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsS0FFN0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDN0IsOEJBQU07QUFBQSxpQkFDYjthQUNKOzs7Ozs7V0FuVVEsYUFBYSIsImZpbGUiOiJzcmMvU2NvcGVSZXNvbHZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIFRPRE86ICBIb3cgd2UgZGVhbCB3aXRoIHRoZSBpbnNhbml0eSB0aGF0IGlzIHdpdGggc3RhdGVtZW50cz9cbi8vIFRPRE86ICBQYXJhbSBzY29wZXMgaGF2ZSBlbXB0eSBmcmVlIGxpc3RzLCB3aGljaCBpcyBzdHJhbmdlXG5cbmNsYXNzIFNjb3BlIHtcblxuICAgIGNvbnN0cnVjdG9yKHR5cGUpIHtcblxuICAgICAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IFwiYmxvY2tcIjtcbiAgICAgICAgdGhpcy5uYW1lcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICAgIHRoaXMuZnJlZSA9IFtdO1xuICAgICAgICB0aGlzLnN0cmljdCA9IGZhbHNlO1xuICAgICAgICB0aGlzLnBhcmVudCA9IG51bGw7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgdGhpcy52YXJOYW1lcyA9IFtdO1xuICAgIH1cblxuICAgIHJlc29sdmVOYW1lKG5hbWUpIHtcblxuICAgICAgICBpZiAodGhpcy5uYW1lc1tuYW1lXSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5hbWVzW25hbWVdO1xuXG4gICAgICAgIGlmICh0aGlzLnBhcmVudClcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5yZXNvbHZlTmFtZShuYW1lKTtcblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTY29wZVJlc29sdmVyIHtcblxuICAgIHJlc29sdmUocGFyc2VSZXN1bHQpIHtcblxuICAgICAgICB0aGlzLnBhcnNlUmVzdWx0ID0gcGFyc2VSZXN1bHQ7XG4gICAgICAgIHRoaXMuc3RhY2sgPSBbXTtcbiAgICAgICAgdGhpcy50b3AgPSBuZXcgU2NvcGUoXCJ2YXJcIik7XG5cbiAgICAgICAgdGhpcy52aXNpdChwYXJzZVJlc3VsdC5hc3QpO1xuICAgICAgICB0aGlzLmZsdXNoRnJlZSgpO1xuXG4gICAgICAgIHBhcnNlUmVzdWx0LnNjb3BlVHJlZSA9IHRoaXMudG9wO1xuICAgIH1cblxuICAgZmFpbChtc2csIG5vZGUpIHtcblxuICAgICAgICB0aHJvdyB0aGlzLnBhcnNlUmVzdWx0LmNyZWF0ZVN5bnRheEVycm9yKG1zZywgbm9kZSk7XG4gICAgfVxuXG4gICAgcHVzaFNjb3BlKHR5cGUpIHtcblxuICAgICAgICBsZXQgc3RyaWN0ID0gdGhpcy50b3Auc3RyaWN0O1xuICAgICAgICB0aGlzLnN0YWNrLnB1c2godGhpcy50b3ApO1xuICAgICAgICB0aGlzLnRvcCA9IG5ldyBTY29wZSh0eXBlKTtcbiAgICAgICAgdGhpcy50b3Auc3RyaWN0ID0gc3RyaWN0O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnRvcDtcbiAgICB9XG5cbiAgICBmbHVzaEZyZWUoKSB7XG5cbiAgICAgICAgbGV0IG1hcCA9IHRoaXMudG9wLm5hbWVzLFxuICAgICAgICAgICAgZnJlZSA9IHRoaXMudG9wLmZyZWUsXG4gICAgICAgICAgICBuZXh0ID0gbnVsbCxcbiAgICAgICAgICAgIGZyZWVMaXN0ID0gW107XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhY2subGVuZ3RoID4gMClcbiAgICAgICAgICAgIG5leHQgPSB0aGlzLnN0YWNrW3RoaXMuc3RhY2subGVuZ3RoIC0gMV07XG5cbiAgICAgICAgdGhpcy50b3AuZnJlZSA9IGZyZWVMaXN0O1xuXG4gICAgICAgIGZyZWUuZm9yRWFjaChyID0+IHtcblxuICAgICAgICAgICAgbGV0IG5hbWUgPSByLnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAobWFwW25hbWVdKSB7XG5cbiAgICAgICAgICAgICAgICBtYXBbbmFtZV0ucmVmZXJlbmNlcy5wdXNoKHIpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgZnJlZUxpc3QucHVzaChyKTtcblxuICAgICAgICAgICAgICAgIGlmIChuZXh0KVxuICAgICAgICAgICAgICAgICAgICBuZXh0LmZyZWUucHVzaChyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgbGlua1Njb3BlKGNoaWxkKSB7XG5cbiAgICAgICAgbGV0IHAgPSB0aGlzLnRvcDtcbiAgICAgICAgY2hpbGQucGFyZW50ID0gcDtcbiAgICAgICAgcC5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcbiAgICB9XG5cbiAgICBwb3BTY29wZSgpIHtcblxuICAgICAgICBsZXQgc2NvcGUgPSB0aGlzLnRvcCxcbiAgICAgICAgICAgIHZhck5hbWVzID0gc2NvcGUudmFyTmFtZXMsXG4gICAgICAgICAgICBmcmVlID0gc2NvcGUuZnJlZTtcblxuICAgICAgICBzY29wZS52YXJOYW1lcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5mbHVzaEZyZWUoKTtcbiAgICAgICAgdGhpcy50b3AgPSB0aGlzLnN0YWNrLnBvcCgpO1xuICAgICAgICB0aGlzLmxpbmtTY29wZShzY29wZSk7XG5cbiAgICAgICAgdmFyTmFtZXMuZm9yRWFjaChuID0+IHtcblxuICAgICAgICAgICAgaWYgKHNjb3BlLm5hbWVzW24udmFsdWVdKVxuICAgICAgICAgICAgICAgIHRoaXMuZmFpbChcIkNhbm5vdCBzaGFkb3cgbGV4aWNhbCBkZWNsYXJhdGlvbiB3aXRoIHZhclwiLCBuKTtcbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMudG9wLnR5cGUgPT09IFwidmFyXCIpXG4gICAgICAgICAgICAgICAgdGhpcy5hZGROYW1lKG4sIFwidmFyXCIpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHRoaXMudG9wLnZhck5hbWVzLnB1c2gobik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHZpc2l0KG5vZGUsIGtpbmQpIHtcblxuICAgICAgICBpZiAoIW5vZGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbGV0IGYgPSB0aGlzW25vZGUudHlwZV07XG5cbiAgICAgICAgaWYgKHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICBmLmNhbGwodGhpcywgbm9kZSwga2luZCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4oKS5mb3JFYWNoKG4gPT4gdGhpcy52aXNpdChuLCBraW5kKSk7XG4gICAgfVxuXG4gICAgaGFzU3RyaWN0RGlyZWN0aXZlKHN0YXRlbWVudHMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlbWVudHMubGVuZ3RoOyArK2kpIHtcblxuICAgICAgICAgICAgbGV0IG4gPSBzdGF0ZW1lbnRzW2ldO1xuXG4gICAgICAgICAgICBpZiAobi50eXBlICE9PSBcIkRpcmVjdGl2ZVwiKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBpZiAobi52YWx1ZSA9PT0gXCJ1c2Ugc3RyaWN0XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmlzaXRGdW5jdGlvbihwYXJhbXMsIGJvZHksIHN0cmljdFBhcmFtcykge1xuXG4gICAgICAgIGxldCBwYXJhbVNjb3BlID0gdGhpcy5wdXNoU2NvcGUoXCJwYXJhbVwiKTtcblxuICAgICAgICBpZiAoIXRoaXMudG9wLnN0cmljdCAmJlxuICAgICAgICAgICAgYm9keS5zdGF0ZW1lbnRzICYmXG4gICAgICAgICAgICB0aGlzLmhhc1N0cmljdERpcmVjdGl2ZShib2R5LnN0YXRlbWVudHMpKSB7XG5cbiAgICAgICAgICAgIHRoaXMudG9wLnN0cmljdCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBzdHJpY3RQYXJhbXMgPSBzdHJpY3RQYXJhbXMgfHwgdGhpcy50b3Auc3RyaWN0O1xuXG4gICAgICAgIHBhcmFtcy5mb3JFYWNoKG4gPT4ge1xuXG4gICAgICAgICAgICBpZiAoIXN0cmljdFBhcmFtcyAmJiAoXG4gICAgICAgICAgICAgICAgbi50eXBlICE9PSBcIkZvcm1hbFBhcmFtZXRlclwiIHx8XG4gICAgICAgICAgICAgICAgbi5pbml0aWFsaXplciB8fFxuICAgICAgICAgICAgICAgIG4ucGF0dGVybi50eXBlICE9PSBcIklkZW50aWZpZXJcIikpIHtcblxuICAgICAgICAgICAgICAgIHN0cmljdFBhcmFtcyA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudmlzaXQobiwgXCJwYXJhbVwiKTtcbiAgICAgICAgICAgIHRoaXMuZmx1c2hGcmVlKCk7XG4gICAgICAgICAgICB0aGlzLnRvcC5mcmVlLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwidmFyXCIpO1xuICAgICAgICBsZXQgYmxvY2tTY29wZSA9IHRoaXMucHVzaFNjb3BlKFwiYmxvY2tcIik7XG4gICAgICAgIHRoaXMudmlzaXQoYm9keSwgXCJ2YXJcIik7XG4gICAgICAgIHRoaXMucG9wU2NvcGUoKTtcbiAgICAgICAgdGhpcy5wb3BTY29wZSgpO1xuXG4gICAgICAgIHRoaXMucG9wU2NvcGUoKTtcblxuICAgICAgICBPYmplY3Qua2V5cyhwYXJhbVNjb3BlLm5hbWVzKS5mb3JFYWNoKG5hbWUgPT4ge1xuXG4gICAgICAgICAgICBpZiAoYmxvY2tTY29wZS5uYW1lc1tuYW1lXSlcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJEdXBsaWNhdGUgYmxvY2sgZGVjbGFyYXRpb25cIiwgYmxvY2tTY29wZS5uYW1lc1tuYW1lXS5kZWNsYXJhdGlvbnNbMF0pO1xuXG4gICAgICAgICAgICBpZiAoc3RyaWN0UGFyYW1zICYmIHBhcmFtU2NvcGUubmFtZXNbbmFtZV0uZGVjbGFyYXRpb25zLmxlbmd0aCA+IDEpXG4gICAgICAgICAgICAgICAgdGhpcy5mYWlsKFwiRHVwbGljYXRlIHBhcmFtZXRlciBuYW1lc1wiLCBwYXJhbVNjb3BlLm5hbWVzW25hbWVdLmRlY2xhcmF0aW9uc1sxXSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGFkZFJlZmVyZW5jZShub2RlKSB7XG5cbiAgICAgICAgbGV0IG5hbWUgPSBub2RlLnZhbHVlLFxuICAgICAgICAgICAgbWFwID0gdGhpcy50b3AubmFtZXMsXG4gICAgICAgICAgICBuZXh0ID0gdGhpcy5zdGFja1t0aGlzLnN0YWNrLmxlbmd0aCAtIDFdO1xuXG4gICAgICAgIGlmIChtYXBbbmFtZV0pIG1hcFtuYW1lXS5yZWZlcmVuY2VzLnB1c2gobm9kZSk7XG4gICAgICAgIGVsc2UgdG9wLmZyZWUucHVzaChub2RlKTtcbiAgICB9XG5cbiAgICBhZGROYW1lKG5vZGUsIGtpbmQpIHtcblxuICAgICAgICBsZXQgbmFtZSA9IG5vZGUudmFsdWUsXG4gICAgICAgICAgICBtYXAgPSB0aGlzLnRvcC5uYW1lcyxcbiAgICAgICAgICAgIHJlY29yZCA9IG1hcFtuYW1lXTtcblxuICAgICAgICBpZiAocmVjb3JkKSB7XG5cbiAgICAgICAgICAgIGlmIChraW5kICE9PSBcInZhclwiICYmIGtpbmQgIT09IFwicGFyYW1cIilcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJEdXBsaWNhdGUgdmFyaWFibGUgZGVjbGFyYXRpb25cIiwgbm9kZSk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgaWYgKG5hbWUgPT09IFwibGV0XCIgJiYgKGtpbmQgPT09IFwibGV0XCIgfHwga2luZCA9PT0gXCJjb25zdFwiKSlcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIGJpbmRpbmcgaWRlbnRpZmllclwiLCBub2RlKTtcblxuICAgICAgICAgICAgbWFwW25hbWVdID0gcmVjb3JkID0geyBkZWNsYXJhdGlvbnM6IFtdLCByZWZlcmVuY2VzOiBbXSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmVjb3JkLmRlY2xhcmF0aW9ucy5wdXNoKG5vZGUpO1xuICAgIH1cblxuICAgIFNjcmlwdChub2RlKSB7XG5cbiAgICAgICAgdGhpcy5wdXNoU2NvcGUoXCJibG9ja1wiKTtcblxuICAgICAgICBpZiAodGhpcy5oYXNTdHJpY3REaXJlY3RpdmUobm9kZS5zdGF0ZW1lbnRzKSlcbiAgICAgICAgICAgIHRoaXMudG9wLnN0cmljdCA9IHRydWU7XG5cbiAgICAgICAgbm9kZS5jaGlsZHJlbigpLmZvckVhY2gobiA9PiB0aGlzLnZpc2l0KG4sIFwidmFyXCIpKTtcblxuICAgICAgICB0aGlzLnBvcFNjb3BlKCk7XG4gICAgfVxuXG4gICAgTW9kdWxlKG5vZGUpIHtcblxuICAgICAgICB0aGlzLnB1c2hTY29wZShcImJsb2NrXCIpO1xuICAgICAgICB0aGlzLnRvcC5zdHJpY3QgPSB0cnVlO1xuICAgICAgICBub2RlLmNoaWxkcmVuKCkuZm9yRWFjaChuID0+IHRoaXMudmlzaXQobiwgXCJ2YXJcIikpO1xuICAgICAgICB0aGlzLnBvcFNjb3BlKCk7XG4gICAgfVxuXG4gICAgQmxvY2sobm9kZSkge1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiYmxvY2tcIik7XG4gICAgICAgIG5vZGUuY2hpbGRyZW4oKS5mb3JFYWNoKG4gPT4gdGhpcy52aXNpdChuKSk7XG4gICAgICAgIHRoaXMucG9wU2NvcGUoKTtcbiAgICB9XG5cbiAgICBTd2l0Y2hTdGF0ZW1lbnQobm9kZSkge1xuXG4gICAgICAgIHRoaXMuQmxvY2sobm9kZSk7XG4gICAgfVxuXG4gICAgRm9yT2ZTdGF0ZW1lbnQobm9kZSkge1xuXG4gICAgICAgIHRoaXMuRm9yU3RhdGVtZW50KG5vZGUpO1xuICAgIH1cblxuICAgIEZvckluU3RhdGVtZW50KG5vZGUpIHtcblxuICAgICAgICB0aGlzLkZvclN0YXRlbWVudChub2RlKTtcbiAgICB9XG5cbiAgICBGb3JTdGF0ZW1lbnQobm9kZSkge1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiZm9yXCIpO1xuICAgICAgICBub2RlLmNoaWxkcmVuKCkuZm9yRWFjaChuID0+IHRoaXMudmlzaXQobikpO1xuICAgICAgICB0aGlzLnBvcFNjb3BlKCk7XG4gICAgfVxuXG4gICAgQ2F0Y2hDbGF1c2Uobm9kZSkge1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiY2F0Y2hcIik7XG4gICAgICAgIHRoaXMudmlzaXQobm9kZS5wYXJhbSk7XG4gICAgICAgIG5vZGUuYm9keS5jaGlsZHJlbigpLmZvckVhY2gobiA9PiB0aGlzLnZpc2l0KG4pKTtcbiAgICAgICAgdGhpcy5wb3BTY29wZSgpO1xuICAgIH1cblxuICAgIFZhcmlhYmxlRGVjbGFyYXRpb24obm9kZSkge1xuXG4gICAgICAgIG5vZGUuY2hpbGRyZW4oKS5mb3JFYWNoKG4gPT4gdGhpcy52aXNpdChuLCBub2RlLmtpbmQpKTtcbiAgICB9XG5cbiAgICBGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUsIGtpbmQpIHtcblxuICAgICAgICB0aGlzLnZpc2l0KG5vZGUuaWRlbnRpZmllciwga2luZCk7XG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiZnVuY3Rpb25cIik7XG4gICAgICAgIHRoaXMudmlzaXRGdW5jdGlvbihub2RlLnBhcmFtcywgbm9kZS5ib2R5LCBmYWxzZSk7XG4gICAgICAgIHRoaXMucG9wU2NvcGUoKTtcbiAgICB9XG5cbiAgICBGdW5jdGlvbkV4cHJlc3Npb24obm9kZSkge1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiZnVuY3Rpb25cIik7XG4gICAgICAgIHRoaXMudmlzaXQobm9kZS5pZGVudGlmaWVyKTtcbiAgICAgICAgdGhpcy52aXNpdEZ1bmN0aW9uKG5vZGUucGFyYW1zLCBub2RlLmJvZHksIGZhbHNlKTtcbiAgICAgICAgdGhpcy5wb3BTY29wZSgpO1xuICAgIH1cblxuICAgIE1ldGhvZERlZmluaXRpb24obm9kZSkge1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiZnVuY3Rpb25cIik7XG4gICAgICAgIHRoaXMudmlzaXRGdW5jdGlvbihub2RlLnBhcmFtcywgbm9kZS5ib2R5LCB0cnVlKTtcbiAgICAgICAgdGhpcy5wb3BTY29wZSgpO1xuICAgIH1cblxuICAgIEFycm93RnVuY3Rpb24obm9kZSkge1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiZnVuY3Rpb25cIik7XG4gICAgICAgIHRoaXMudmlzaXRGdW5jdGlvbihub2RlLnBhcmFtcywgbm9kZS5ib2R5LCB0cnVlKTtcbiAgICAgICAgdGhpcy5wb3BTY29wZSgpO1xuICAgIH1cblxuICAgIENsYXNzRGVjbGFyYXRpb24obm9kZSkge1xuXG4gICAgICAgIHRoaXMudmlzaXQobm9kZS5pZGVudGlmaWVyLCBcImxldFwiKTtcbiAgICAgICAgdGhpcy5wdXNoU2NvcGUoXCJjbGFzc1wiKTtcbiAgICAgICAgdGhpcy50b3Auc3RyaWN0ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy52aXNpdChub2RlLmJhc2UpO1xuICAgICAgICB0aGlzLnZpc2l0KG5vZGUuYm9keSk7XG4gICAgICAgIHRoaXMucG9wU2NvcGUoKTtcbiAgICB9XG5cbiAgICBDbGFzc0V4cHJlc3Npb24obm9kZSkge1xuXG4gICAgICAgIHRoaXMucHVzaFNjb3BlKFwiY2xhc3NcIik7XG4gICAgICAgIHRoaXMudG9wLnN0cmljdCA9IHRydWU7XG4gICAgICAgIHRoaXMudmlzaXQobm9kZS5pZGVudGlmaWVyKTtcbiAgICAgICAgdGhpcy52aXNpdChub2RlLmJhc2UpO1xuICAgICAgICB0aGlzLnZpc2l0KG5vZGUuYm9keSk7XG4gICAgICAgIHRoaXMucG9wU2NvcGUoKTtcbiAgICB9XG5cbiAgICBJZGVudGlmaWVyKG5vZGUsIGtpbmQpIHtcblxuICAgICAgICBzd2l0Y2ggKG5vZGUuY29udGV4dCkge1xuXG4gICAgICAgICAgICBjYXNlIFwidmFyaWFibGVcIjpcbiAgICAgICAgICAgICAgICB0aGlzLnRvcC5mcmVlLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJkZWNsYXJhdGlvblwiOlxuICAgICAgICAgICAgICAgIGlmIChraW5kID09PSBcInZhclwiICYmIHRoaXMudG9wLnR5cGUgIT09IFwidmFyXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9wLnZhck5hbWVzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZE5hbWUobm9kZSwga2luZCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbn1cbiJdfQ==