"use strict";

// istanbul ignore next
var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

// istanbul ignore next
var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var isStrictReservedWord = require("./Scanner.js").isStrictReservedWord;



// Returns true if the specified name is a restricted identifier in strict mode
function isPoisonIdent(name) {
    return name === "eval" || name === "arguments";
}

// Unwraps parens surrounding an expression
function unwrapParens(node) {
    // Remove any parenthesis surrounding the target
    for (; node.type === "ParenExpression"; node = node.expression);
    return node;
}

var Validate = exports.Validate = (function () {
    function Validate() {
        _classCallCheck(this, Validate);
    }

    _prototypeProperties(Validate, null, {
        checkAssignmentTarget: {

            // Validates an assignment target
            value: function checkAssignmentTarget(node, simple) {
                switch (node.type) {

                    case "Identifier":


                        if (isPoisonIdent(node.value)) this.addStrictError("Cannot modify " + node.value + " in strict mode", node);

                        return;

                    case "MemberExpression":
                    case "AtName":
                        return;

                    case "ObjectPattern":
                    case "ArrayPattern":
                        if (!simple) {
                            return;
                        }break;

                    case "ObjectLiteral":
                        if (!simple) {
                            this.transformObjectPattern(node, false);return;
                        }
                        break;

                    case "ArrayLiteral":
                        if (!simple) {
                            this.transformArrayPattern(node, false);return;
                        }
                        break;

                }

                this.fail("Invalid left-hand side in assignment", node);
            },
            writable: true,
            configurable: true
        },
        checkBindingTarget: {

            // Validates a binding target
            value: function checkBindingTarget(node) {
                switch (node.type) {

                    case "Identifier":


                        // Perform basic identifier validation
                        this.checkIdentifier(node);

                        // Mark identifier node as a declaration
                        node.context = "declaration";

                        var name = node.value;

                        if (isPoisonIdent(name)) this.addStrictError("Binding cannot be created for '" + name + "' in strict mode", node);

                        return;

                    case "ArrayLiteral":
                    case "ArrayPattern":
                        this.transformArrayPattern(node, true);
                        return;

                    case "ObjectLiteral":
                    case "ObjectPattern":
                        this.transformObjectPattern(node, true);
                        return;

                }

                this.fail("Invalid binding target", node);
            },
            writable: true,
            configurable: true
        },
        checkPatternTarget: {

            // Validates a target in a binding or assignment pattern
            value: function checkPatternTarget(node, binding) {
                return binding ? this.checkBindingTarget(node) : this.checkAssignmentTarget(node, false);
            },
            writable: true,
            configurable: true
        },
        checkIdentifier: {

            // Checks an identifier for strict mode reserved words
            value: function checkIdentifier(node) {
                var ident = node.value;

                if (ident === "yield" && this.context.isGenerator) this.fail("yield cannot be an identifier inside of a generator function", node);else if (ident === "await" && this.context.isAsync) this.fail("await cannot be an identifier inside of an async function", node);else if (isStrictReservedWord(ident)) this.addStrictError(ident + " cannot be used as an identifier in strict mode", node);
            },
            writable: true,
            configurable: true
        },
        checkParameters: {

            // Checks function formal parameters for strict mode restrictions
            value: function checkParameters(params, kind) {
                for (var i = 0; i < params.length; ++i) {
                    var node = params[i];

                    if (node.type !== "FormalParameter" || node.pattern.type !== "Identifier") continue;

                    var _name = node.pattern.value;

                    if (isPoisonIdent(_name)) this.addStrictError("Parameter name " + _name + " is not allowed in strict mode", node);
                }
            },
            writable: true,
            configurable: true
        },
        checkArrowParameters: {

            // Performs validation on transformed arrow formal parameters
            value: function checkArrowParameters(params) {
                params = this.transformFormals(params);
                // TODO: Check that formal parameters do not contain yield expressions or
                // await expressions
                this.checkParameters(params);
                return params;
            },
            writable: true,
            configurable: true
        },
        checkForInit: {

            // Performs validation on the init portion of a for-in or for-of statement
            value: function checkForInit(init, type) {
                if (init.type === "VariableDeclaration") {
                    // For-in/of may only have one variable declaration
                    if (init.declarations.length !== 1) this.fail("for-" + type + " statement may not have more than one variable declaration", init);

                    var decl = init.declarations[0];

                    // Initializers are not allowed in for in and for of
                    if (decl.initializer) this.fail("Invalid initializer in for-" + type + " statement", init);
                } else {
                    this.checkAssignmentTarget(this.unwrapParens(init));
                }
            },
            writable: true,
            configurable: true
        },
        checkInvalidNodes: {
            value: function checkInvalidNodes() {
                var context = this.context,
                    parent = context.parent,
                    list = context.invalidNodes;

                for (var i = 0; i < list.length; ++i) {
                    var item = list[i],
                        node = item.node,
                        error = node.error;

                    // Skip if error has been resolved
                    if (!error) continue;

                    // Throw if item is not a strict-mode-only error, or if the current
                    // context is strict
                    if (!item.strict || context.mode === "strict") this.fail(error, node);

                    // Skip strict errors in sloppy mode
                    if (context.mode === "sloppy") continue;

                    // If the parent context is sloppy, then we ignore. If the parent context
                    // is strict, then this context would also be known to be strict and
                    // therefore handled above.

                    // If parent mode has not been determined, add error to
                    // parent context
                    if (!parent.mode) parent.invalidNodes.push(item);
                }
            },
            writable: true,
            configurable: true
        },
        checkDelete: {
            value: function checkDelete(node) {
                node = this.unwrapParens(node);

                if (node.type === "Identifier") this.addStrictError("Cannot delete unqualified property in strict mode", node);
            },
            writable: true,
            configurable: true
        }
    });

    return Validate;
})();
//# sourceMappingURL=data:application/json;base64,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LENBQUMsQ0FBQyxDQUFDO3dCQUNkLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSTt3QkFDaEIsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7OztBQUd2Qix3QkFBSSxDQUFDLEtBQUssRUFDTixTQUFTOzs7O0FBSWIsd0JBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUN6QyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQzs7O0FBRzNCLHdCQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUN6QixTQUFTOzs7Ozs7OztBQVFiLHdCQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFDWixNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDdEM7YUFFSjs7OztBQUVELG1CQUFXO21CQUFBLHFCQUFDLElBQUksRUFBRTtBQUVkLG9CQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQzs7QUFFL0Isb0JBQUksSUFBSSxDQUFDLElBQUksS0FBSyxZQUFZLEVBQzFCLElBQUksQ0FBQyxjQUFjLENBQUMsbURBQW1ELEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDdEY7Ozs7OztXQXJMUSxRQUFRIiwiZmlsZSI6InNyYy9WYWxpZGF0ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzU3RyaWN0UmVzZXJ2ZWRXb3JkIH0gZnJvbSBcIi4vU2Nhbm5lci5qc1wiO1xuXG5cbi8vIFJldHVybnMgdHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIG5hbWUgaXMgYSByZXN0cmljdGVkIGlkZW50aWZpZXIgaW4gc3RyaWN0IG1vZGVcbmZ1bmN0aW9uIGlzUG9pc29uSWRlbnQobmFtZSkge1xuXG4gICAgcmV0dXJuIG5hbWUgPT09IFwiZXZhbFwiIHx8IG5hbWUgPT09IFwiYXJndW1lbnRzXCI7XG59XG5cbi8vIFVud3JhcHMgcGFyZW5zIHN1cnJvdW5kaW5nIGFuIGV4cHJlc3Npb25cbmZ1bmN0aW9uIHVud3JhcFBhcmVucyhub2RlKSB7XG5cbiAgICAvLyBSZW1vdmUgYW55IHBhcmVudGhlc2lzIHN1cnJvdW5kaW5nIHRoZSB0YXJnZXRcbiAgICBmb3IgKDsgbm9kZS50eXBlID09PSBcIlBhcmVuRXhwcmVzc2lvblwiOyBub2RlID0gbm9kZS5leHByZXNzaW9uKTtcbiAgICByZXR1cm4gbm9kZTtcbn1cblxuZXhwb3J0IGNsYXNzIFZhbGlkYXRlIHtcblxuICAgIC8vIFZhbGlkYXRlcyBhbiBhc3NpZ25tZW50IHRhcmdldFxuICAgIGNoZWNrQXNzaWdubWVudFRhcmdldChub2RlLCBzaW1wbGUpIHtcblxuICAgICAgICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuXG4gICAgICAgICAgICBjYXNlIFwiSWRlbnRpZmllclwiOlxuXG4gICAgICAgICAgICAgICAgaWYgKGlzUG9pc29uSWRlbnQobm9kZS52YWx1ZSkpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkU3RyaWN0RXJyb3IoXCJDYW5ub3QgbW9kaWZ5IFwiICsgbm9kZS52YWx1ZSArIFwiIGluIHN0cmljdCBtb2RlXCIsIG5vZGUpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjYXNlIFwiTWVtYmVyRXhwcmVzc2lvblwiOlxuICAgICAgICAgICAgY2FzZSBcIkF0TmFtZVwiOlxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgY2FzZSBcIk9iamVjdFBhdHRlcm5cIjpcbiAgICAgICAgICAgIGNhc2UgXCJBcnJheVBhdHRlcm5cIjpcbiAgICAgICAgICAgICAgICBpZiAoIXNpbXBsZSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwiT2JqZWN0TGl0ZXJhbFwiOlxuICAgICAgICAgICAgICAgIGlmICghc2ltcGxlKSB7IHRoaXMudHJhbnNmb3JtT2JqZWN0UGF0dGVybihub2RlLCBmYWxzZSk7IHJldHVybiB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJBcnJheUxpdGVyYWxcIjpcbiAgICAgICAgICAgICAgICBpZiAoIXNpbXBsZSkgeyB0aGlzLnRyYW5zZm9ybUFycmF5UGF0dGVybihub2RlLCBmYWxzZSk7IHJldHVybiB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmFpbChcIkludmFsaWQgbGVmdC1oYW5kIHNpZGUgaW4gYXNzaWdubWVudFwiLCBub2RlKTtcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZXMgYSBiaW5kaW5nIHRhcmdldFxuICAgIGNoZWNrQmluZGluZ1RhcmdldChub2RlKSB7XG5cbiAgICAgICAgc3dpdGNoIChub2RlLnR5cGUpIHtcblxuICAgICAgICAgICAgY2FzZSBcIklkZW50aWZpZXJcIjpcblxuICAgICAgICAgICAgICAgIC8vIFBlcmZvcm0gYmFzaWMgaWRlbnRpZmllciB2YWxpZGF0aW9uXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja0lkZW50aWZpZXIobm9kZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBNYXJrIGlkZW50aWZpZXIgbm9kZSBhcyBhIGRlY2xhcmF0aW9uXG4gICAgICAgICAgICAgICAgbm9kZS5jb250ZXh0ID0gXCJkZWNsYXJhdGlvblwiO1xuXG4gICAgICAgICAgICAgICAgbGV0IG5hbWUgPSBub2RlLnZhbHVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzUG9pc29uSWRlbnQobmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkU3RyaWN0RXJyb3IoXCJCaW5kaW5nIGNhbm5vdCBiZSBjcmVhdGVkIGZvciAnXCIgKyBuYW1lICsgXCInIGluIHN0cmljdCBtb2RlXCIsIG5vZGUpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjYXNlIFwiQXJyYXlMaXRlcmFsXCI6XG4gICAgICAgICAgICBjYXNlIFwiQXJyYXlQYXR0ZXJuXCI6XG4gICAgICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1BcnJheVBhdHRlcm4obm9kZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjYXNlIFwiT2JqZWN0TGl0ZXJhbFwiOlxuICAgICAgICAgICAgY2FzZSBcIk9iamVjdFBhdHRlcm5cIjpcbiAgICAgICAgICAgICAgICB0aGlzLnRyYW5zZm9ybU9iamVjdFBhdHRlcm4obm9kZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIGJpbmRpbmcgdGFyZ2V0XCIsIG5vZGUpO1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlcyBhIHRhcmdldCBpbiBhIGJpbmRpbmcgb3IgYXNzaWdubWVudCBwYXR0ZXJuXG4gICAgY2hlY2tQYXR0ZXJuVGFyZ2V0KG5vZGUsIGJpbmRpbmcpIHtcblxuICAgICAgICByZXR1cm4gYmluZGluZyA/IHRoaXMuY2hlY2tCaW5kaW5nVGFyZ2V0KG5vZGUpIDogdGhpcy5jaGVja0Fzc2lnbm1lbnRUYXJnZXQobm9kZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIENoZWNrcyBhbiBpZGVudGlmaWVyIGZvciBzdHJpY3QgbW9kZSByZXNlcnZlZCB3b3Jkc1xuICAgIGNoZWNrSWRlbnRpZmllcihub2RlKSB7XG5cbiAgICAgICAgbGV0IGlkZW50ID0gbm9kZS52YWx1ZTtcblxuICAgICAgICBpZiAoaWRlbnQgPT09IFwieWllbGRcIiAmJiB0aGlzLmNvbnRleHQuaXNHZW5lcmF0b3IpXG4gICAgICAgICAgICB0aGlzLmZhaWwoXCJ5aWVsZCBjYW5ub3QgYmUgYW4gaWRlbnRpZmllciBpbnNpZGUgb2YgYSBnZW5lcmF0b3IgZnVuY3Rpb25cIiwgbm9kZSk7XG4gICAgICAgIGVsc2UgaWYgKGlkZW50ID09PSBcImF3YWl0XCIgJiYgdGhpcy5jb250ZXh0LmlzQXN5bmMpXG4gICAgICAgICAgICB0aGlzLmZhaWwoXCJhd2FpdCBjYW5ub3QgYmUgYW4gaWRlbnRpZmllciBpbnNpZGUgb2YgYW4gYXN5bmMgZnVuY3Rpb25cIiwgbm9kZSk7XG4gICAgICAgIGVsc2UgaWYgKGlzU3RyaWN0UmVzZXJ2ZWRXb3JkKGlkZW50KSlcbiAgICAgICAgICAgIHRoaXMuYWRkU3RyaWN0RXJyb3IoaWRlbnQgKyBcIiBjYW5ub3QgYmUgdXNlZCBhcyBhbiBpZGVudGlmaWVyIGluIHN0cmljdCBtb2RlXCIsIG5vZGUpO1xuICAgIH1cblxuICAgIC8vIENoZWNrcyBmdW5jdGlvbiBmb3JtYWwgcGFyYW1ldGVycyBmb3Igc3RyaWN0IG1vZGUgcmVzdHJpY3Rpb25zXG4gICAgY2hlY2tQYXJhbWV0ZXJzKHBhcmFtcywga2luZCkge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyYW1zLmxlbmd0aDsgKytpKSB7XG5cbiAgICAgICAgICAgIGxldCBub2RlID0gcGFyYW1zW2ldO1xuXG4gICAgICAgICAgICBpZiAobm9kZS50eXBlICE9PSBcIkZvcm1hbFBhcmFtZXRlclwiIHx8IG5vZGUucGF0dGVybi50eXBlICE9PSBcIklkZW50aWZpZXJcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IG5hbWUgPSBub2RlLnBhdHRlcm4udmFsdWU7XG5cbiAgICAgICAgICAgIGlmIChpc1BvaXNvbklkZW50KG5hbWUpKVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkU3RyaWN0RXJyb3IoXCJQYXJhbWV0ZXIgbmFtZSBcIiArIG5hbWUgKyBcIiBpcyBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZVwiLCBub2RlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBlcmZvcm1zIHZhbGlkYXRpb24gb24gdHJhbnNmb3JtZWQgYXJyb3cgZm9ybWFsIHBhcmFtZXRlcnNcbiAgICBjaGVja0Fycm93UGFyYW1ldGVycyhwYXJhbXMpIHtcblxuICAgICAgICBwYXJhbXMgPSB0aGlzLnRyYW5zZm9ybUZvcm1hbHMocGFyYW1zKTtcbiAgICAgICAgLy8gVE9ETzogQ2hlY2sgdGhhdCBmb3JtYWwgcGFyYW1ldGVycyBkbyBub3QgY29udGFpbiB5aWVsZCBleHByZXNzaW9ucyBvclxuICAgICAgICAvLyBhd2FpdCBleHByZXNzaW9uc1xuICAgICAgICB0aGlzLmNoZWNrUGFyYW1ldGVycyhwYXJhbXMpO1xuICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cblxuICAgIC8vIFBlcmZvcm1zIHZhbGlkYXRpb24gb24gdGhlIGluaXQgcG9ydGlvbiBvZiBhIGZvci1pbiBvciBmb3Itb2Ygc3RhdGVtZW50XG4gICAgY2hlY2tGb3JJbml0KGluaXQsIHR5cGUpIHtcblxuICAgICAgICBpZiAoaW5pdC50eXBlID09PSBcIlZhcmlhYmxlRGVjbGFyYXRpb25cIikge1xuXG4gICAgICAgICAgICAvLyBGb3ItaW4vb2YgbWF5IG9ubHkgaGF2ZSBvbmUgdmFyaWFibGUgZGVjbGFyYXRpb25cbiAgICAgICAgICAgIGlmIChpbml0LmRlY2xhcmF0aW9ucy5sZW5ndGggIT09IDEpXG4gICAgICAgICAgICAgICAgdGhpcy5mYWlsKFwiZm9yLVwiICsgdHlwZSArIFwiIHN0YXRlbWVudCBtYXkgbm90IGhhdmUgbW9yZSB0aGFuIG9uZSB2YXJpYWJsZSBkZWNsYXJhdGlvblwiLCBpbml0KTtcblxuICAgICAgICAgICAgbGV0IGRlY2wgPSBpbml0LmRlY2xhcmF0aW9uc1swXTtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZXJzIGFyZSBub3QgYWxsb3dlZCBpbiBmb3IgaW4gYW5kIGZvciBvZlxuICAgICAgICAgICAgaWYgKGRlY2wuaW5pdGlhbGl6ZXIpXG4gICAgICAgICAgICAgICAgdGhpcy5mYWlsKFwiSW52YWxpZCBpbml0aWFsaXplciBpbiBmb3ItXCIgKyB0eXBlICsgXCIgc3RhdGVtZW50XCIsIGluaXQpO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIHRoaXMuY2hlY2tBc3NpZ25tZW50VGFyZ2V0KHRoaXMudW53cmFwUGFyZW5zKGluaXQpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNoZWNrSW52YWxpZE5vZGVzKCkge1xuXG4gICAgICAgIGxldCBjb250ZXh0ID0gdGhpcy5jb250ZXh0LFxuICAgICAgICAgICAgcGFyZW50ID0gY29udGV4dC5wYXJlbnQsXG4gICAgICAgICAgICBsaXN0ID0gY29udGV4dC5pbnZhbGlkTm9kZXM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG5cbiAgICAgICAgICAgIGxldCBpdGVtID0gbGlzdFtpXSxcbiAgICAgICAgICAgICAgICBub2RlID0gaXRlbS5ub2RlLFxuICAgICAgICAgICAgICAgIGVycm9yID0gbm9kZS5lcnJvcjtcblxuICAgICAgICAgICAgLy8gU2tpcCBpZiBlcnJvciBoYXMgYmVlbiByZXNvbHZlZFxuICAgICAgICAgICAgaWYgKCFlcnJvcilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gVGhyb3cgaWYgaXRlbSBpcyBub3QgYSBzdHJpY3QtbW9kZS1vbmx5IGVycm9yLCBvciBpZiB0aGUgY3VycmVudFxuICAgICAgICAgICAgLy8gY29udGV4dCBpcyBzdHJpY3RcbiAgICAgICAgICAgIGlmICghaXRlbS5zdHJpY3QgfHwgY29udGV4dC5tb2RlID09PSBcInN0cmljdFwiKVxuICAgICAgICAgICAgICAgIHRoaXMuZmFpbChlcnJvciwgbm9kZSk7XG5cbiAgICAgICAgICAgIC8vIFNraXAgc3RyaWN0IGVycm9ycyBpbiBzbG9wcHkgbW9kZVxuICAgICAgICAgICAgaWYgKGNvbnRleHQubW9kZSA9PT0gXCJzbG9wcHlcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gSWYgdGhlIHBhcmVudCBjb250ZXh0IGlzIHNsb3BweSwgdGhlbiB3ZSBpZ25vcmUuIElmIHRoZSBwYXJlbnQgY29udGV4dFxuICAgICAgICAgICAgLy8gaXMgc3RyaWN0LCB0aGVuIHRoaXMgY29udGV4dCB3b3VsZCBhbHNvIGJlIGtub3duIHRvIGJlIHN0cmljdCBhbmRcbiAgICAgICAgICAgIC8vIHRoZXJlZm9yZSBoYW5kbGVkIGFib3ZlLlxuXG4gICAgICAgICAgICAvLyBJZiBwYXJlbnQgbW9kZSBoYXMgbm90IGJlZW4gZGV0ZXJtaW5lZCwgYWRkIGVycm9yIHRvXG4gICAgICAgICAgICAvLyBwYXJlbnQgY29udGV4dFxuICAgICAgICAgICAgaWYgKCFwYXJlbnQubW9kZSlcbiAgICAgICAgICAgICAgICBwYXJlbnQuaW52YWxpZE5vZGVzLnB1c2goaXRlbSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGNoZWNrRGVsZXRlKG5vZGUpIHtcblxuICAgICAgICBub2RlID0gdGhpcy51bndyYXBQYXJlbnMobm9kZSk7XG5cbiAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIpXG4gICAgICAgICAgICB0aGlzLmFkZFN0cmljdEVycm9yKFwiQ2Fubm90IGRlbGV0ZSB1bnF1YWxpZmllZCBwcm9wZXJ0eSBpbiBzdHJpY3QgbW9kZVwiLCBub2RlKTtcbiAgICB9XG5cbn1cbiJdfQ==