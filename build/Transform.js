"use strict";

// istanbul ignore next
var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

// istanbul ignore next
var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var AST = require("./AST.js");

var isReservedWord = require("./Scanner.js").isReservedWord;
var Transform = exports.Transform = (function () {
    function Transform() {
        _classCallCheck(this, Transform);
    }

    _prototypeProperties(Transform, null, {
        transformFormals: {

            // Transform an expression into a formal parameter list
            value: function transformFormals(expr) {
                if (!expr) {
                    return [];
                }var list = undefined;

                switch (expr.type) {

                    case "SequenceExpression":
                        list = expr.expressions;break;
                    case "CallExpression":
                        list = expr.arguments;break;
                    default:
                        list = [expr];break;
                }

                for (var i = 0; i < list.length; ++i) {
                    var node = list[i],
                        param = undefined;

                    if (i === list.length - 1 && node.type === "SpreadExpression") {
                        expr = node.expression;

                        // Rest parameters can only be identifiers
                        if (expr.type !== "Identifier") this.fail("Invalid rest parameter", expr);

                        this.checkBindingTarget(expr);

                        // Clear parser error for invalid spread expression
                        node.error = "";

                        param = new AST.RestParameter(expr, node.start, node.end);
                    } else {
                        param = new AST.FormalParameter(node, null, node.start, node.end);
                        this.transformPatternElement(param, true);
                    }

                    list[i] = param;
                }

                return list;
            },
            writable: true,
            configurable: true
        },
        transformArrayPattern: {
            value: function transformArrayPattern(node, binding) {
                // NOTE: ArrayPattern and ArrayLiteral are isomorphic
                node.type = "ArrayPattern";

                var elems = node.elements;

                for (var i = 0; i < elems.length; ++i) {
                    var elem = elems[i],
                        expr = undefined;

                    // Skip holes in pattern
                    if (!elem) continue;

                    switch (elem.type) {

                        case "SpreadExpression":


                            // Rest element must be in the last position and cannot be followed
                            // by a comma
                            if (i < elems.length - 1 || node.trailingComma) this.fail("Invalid destructuring pattern", elem);

                            expr = elem.expression;

                            // Rest target cannot be a destructuring pattern
                            switch (expr.type) {

                                case "ObjectLiteral":
                                case "ObjectPattern":
                                case "ArrayLiteral":
                                case "ArrayPattern":
                                    this.fail("Invalid rest pattern", expr);
                            }

                            elem = new AST.PatternRestElement(expr, elem.start, elem.end);
                            this.checkPatternTarget(elem.pattern, binding);
                            break;

                        case "PatternRestElement":
                            this.checkPatternTarget(elem.pattern, binding);
                            break;

                        case "PatternElement":
                            this.transformPatternElement(elem, binding);
                            break;

                        default:
                            elem = new AST.PatternElement(elem, null, elem.start, elem.end);
                            this.transformPatternElement(elem, binding);
                            break;

                    }

                    elems[i] = elem;
                }
            },
            writable: true,
            configurable: true
        },
        transformObjectPattern: {
            value: function transformObjectPattern(node, binding) {
                // NOTE: ObjectPattern and ObjectLiteral are isomorphic
                node.type = "ObjectPattern";

                var props = node.properties;

                for (var i = 0; i < props.length; ++i) {
                    var prop = props[i];

                    // Clear the error flag
                    prop.error = "";

                    switch (prop.type) {

                        case "PropertyDefinition":


                            // Replace node
                            props[i] = prop = new AST.PatternProperty(prop.name, prop.expression, null, prop.start, prop.end);

                            break;

                        case "PatternProperty":
                            break;

                        default:
                            this.fail("Invalid pattern", prop);
                    }

                    if (prop.pattern) this.transformPatternElement(prop, binding);else this.checkPatternTarget(prop.name, binding);
                }
            },
            writable: true,
            configurable: true
        },
        transformPatternElement: {
            value: function transformPatternElement(elem, binding) {
                var node = elem.pattern;

                // Split assignment into pattern and initializer
                if (node && node.type === "AssignmentExpression" && node.operator === "=") {
                    elem.initializer = node.right;
                    elem.pattern = node = node.left;
                }

                this.checkPatternTarget(node, binding);
            },
            writable: true,
            configurable: true
        },
        transformIdentifier: {
            value: function transformIdentifier(node) {
                var value = node.value;

                if (isReservedWord(value)) this.fail("Unexpected token " + value, node);

                this.checkIdentifier(node);
            },
            writable: true,
            configurable: true
        },
        transformDefaultExport: {
            value: function transformDefaultExport(node) {
                var toType = null;

                switch (node.type) {

                    case "ClassExpression":
                        if (node.identifier) toType = "ClassDeclaration";
                        break;

                    case "FunctionExpression":
                        if (node.identifier) toType = "FunctionDeclaration";
                        break;
                }

                if (toType) {
                    node.type = toType;
                    return true;
                }

                return false;
            },
            writable: true,
            configurable: true
        }
    });

    return Transform;
})();
//# sourceMappingURL=data:application/json;base64,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QUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUM5Qix3QkFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztpQkFDbkM7O0FBRUQsb0JBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDMUM7Ozs7QUFFRCwyQkFBbUI7bUJBQUEsNkJBQUMsSUFBSSxFQUFFO0FBRXRCLG9CQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDOztBQUV2QixvQkFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDOztBQUVqRCxvQkFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUM5Qjs7OztBQUVELDhCQUFzQjttQkFBQSxnQ0FBQyxJQUFJLEVBQUU7QUFFekIsb0JBQUksTUFBTSxHQUFHLElBQUksQ0FBQzs7QUFFbEIsd0JBQVEsSUFBSSxDQUFDLElBQUk7O0FBRWIseUJBQUssaUJBQWlCO0FBQ2xCLDRCQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsTUFBTSxHQUFHLGtCQUFrQixDQUFDO0FBQ2pELDhCQUFNOztBQUFBLEFBRVYseUJBQUssb0JBQW9CO0FBQ3JCLDRCQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsTUFBTSxHQUFHLHFCQUFxQixDQUFDO0FBQ3BELDhCQUFNO0FBQUEsaUJBQ2I7O0FBRUQsb0JBQUksTUFBTSxFQUFFO0FBRVIsd0JBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDO0FBQ25CLDJCQUFPLElBQUksQ0FBQztpQkFDZjs7QUFFRCx1QkFBTyxLQUFLLENBQUM7YUFDaEI7Ozs7OztXQXBNUSxTQUFTIiwiZmlsZSI6InNyYy9UcmFuc2Zvcm0uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBBU1QgZnJvbSBcIi4vQVNULmpzXCI7XG5pbXBvcnQgeyBpc1Jlc2VydmVkV29yZCB9IGZyb20gXCIuL1NjYW5uZXIuanNcIjtcblxuXG5leHBvcnQgY2xhc3MgVHJhbnNmb3JtIHtcblxuICAgIC8vIFRyYW5zZm9ybSBhbiBleHByZXNzaW9uIGludG8gYSBmb3JtYWwgcGFyYW1ldGVyIGxpc3RcbiAgICB0cmFuc2Zvcm1Gb3JtYWxzKGV4cHIpIHtcblxuICAgICAgICBpZiAoIWV4cHIpXG4gICAgICAgICAgICByZXR1cm4gW107XG5cbiAgICAgICAgbGV0IGxpc3Q7XG5cbiAgICAgICAgc3dpdGNoIChleHByLnR5cGUpIHtcblxuICAgICAgICAgICAgY2FzZSBcIlNlcXVlbmNlRXhwcmVzc2lvblwiOiBsaXN0ID0gZXhwci5leHByZXNzaW9uczsgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiQ2FsbEV4cHJlc3Npb25cIjogbGlzdCA9IGV4cHIuYXJndW1lbnRzOyBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6IGxpc3QgPSBbZXhwcl07IGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG5cbiAgICAgICAgICAgIGxldCBub2RlID0gbGlzdFtpXSxcbiAgICAgICAgICAgICAgICBwYXJhbTtcblxuICAgICAgICAgICAgaWYgKGkgPT09IGxpc3QubGVuZ3RoIC0gMSAmJiBub2RlLnR5cGUgPT09IFwiU3ByZWFkRXhwcmVzc2lvblwiKSB7XG5cbiAgICAgICAgICAgICAgICBleHByID0gbm9kZS5leHByZXNzaW9uO1xuXG4gICAgICAgICAgICAgICAgLy8gUmVzdCBwYXJhbWV0ZXJzIGNhbiBvbmx5IGJlIGlkZW50aWZpZXJzXG4gICAgICAgICAgICAgICAgaWYgKGV4cHIudHlwZSAhPT0gXCJJZGVudGlmaWVyXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbChcIkludmFsaWQgcmVzdCBwYXJhbWV0ZXJcIiwgZXhwcik7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNoZWNrQmluZGluZ1RhcmdldChleHByKTtcblxuICAgICAgICAgICAgICAgIC8vIENsZWFyIHBhcnNlciBlcnJvciBmb3IgaW52YWxpZCBzcHJlYWQgZXhwcmVzc2lvblxuICAgICAgICAgICAgICAgIG5vZGUuZXJyb3IgPSBcIlwiO1xuXG4gICAgICAgICAgICAgICAgcGFyYW0gPSBuZXcgQVNULlJlc3RQYXJhbWV0ZXIoZXhwciwgbm9kZS5zdGFydCwgbm9kZS5lbmQpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgcGFyYW0gPSBuZXcgQVNULkZvcm1hbFBhcmFtZXRlcihub2RlLCBudWxsLCBub2RlLnN0YXJ0LCBub2RlLmVuZCk7XG4gICAgICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1QYXR0ZXJuRWxlbWVudChwYXJhbSwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxpc3RbaV0gPSBwYXJhbTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgIH1cblxuICAgIHRyYW5zZm9ybUFycmF5UGF0dGVybihub2RlLCBiaW5kaW5nKSB7XG5cbiAgICAgICAgLy8gTk9URTogQXJyYXlQYXR0ZXJuIGFuZCBBcnJheUxpdGVyYWwgYXJlIGlzb21vcnBoaWNcbiAgICAgICAgbm9kZS50eXBlID0gXCJBcnJheVBhdHRlcm5cIjtcblxuICAgICAgICBsZXQgZWxlbXMgPSBub2RlLmVsZW1lbnRzO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZWxlbXMubGVuZ3RoOyArK2kpIHtcblxuICAgICAgICAgICAgbGV0IGVsZW0gPSBlbGVtc1tpXSxcbiAgICAgICAgICAgICAgICBleHByO1xuXG4gICAgICAgICAgICAvLyBTa2lwIGhvbGVzIGluIHBhdHRlcm5cbiAgICAgICAgICAgIGlmICghZWxlbSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgc3dpdGNoIChlbGVtLnR5cGUpIHtcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJTcHJlYWRFeHByZXNzaW9uXCI6XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmVzdCBlbGVtZW50IG11c3QgYmUgaW4gdGhlIGxhc3QgcG9zaXRpb24gYW5kIGNhbm5vdCBiZSBmb2xsb3dlZFxuICAgICAgICAgICAgICAgICAgICAvLyBieSBhIGNvbW1hXG4gICAgICAgICAgICAgICAgICAgIGlmIChpIDwgZWxlbXMubGVuZ3RoIC0gMSB8fCBub2RlLnRyYWlsaW5nQ29tbWEpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIGRlc3RydWN0dXJpbmcgcGF0dGVyblwiLCBlbGVtKTtcblxuICAgICAgICAgICAgICAgICAgICBleHByID0gZWxlbS5leHByZXNzaW9uO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlc3QgdGFyZ2V0IGNhbm5vdCBiZSBhIGRlc3RydWN0dXJpbmcgcGF0dGVyblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGV4cHIudHlwZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiT2JqZWN0TGl0ZXJhbFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcIk9iamVjdFBhdHRlcm5cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJBcnJheUxpdGVyYWxcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJBcnJheVBhdHRlcm5cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIHJlc3QgcGF0dGVyblwiLCBleHByKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGVsZW0gPSBuZXcgQVNULlBhdHRlcm5SZXN0RWxlbWVudChleHByLCBlbGVtLnN0YXJ0LCBlbGVtLmVuZCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tQYXR0ZXJuVGFyZ2V0KGVsZW0ucGF0dGVybiwgYmluZGluZyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIlBhdHRlcm5SZXN0RWxlbWVudFwiOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNoZWNrUGF0dGVyblRhcmdldChlbGVtLnBhdHRlcm4sIGJpbmRpbmcpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJQYXR0ZXJuRWxlbWVudFwiOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRyYW5zZm9ybVBhdHRlcm5FbGVtZW50KGVsZW0sIGJpbmRpbmcpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGVsZW0gPSBuZXcgQVNULlBhdHRlcm5FbGVtZW50KGVsZW0sIG51bGwsIGVsZW0uc3RhcnQsIGVsZW0uZW5kKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1QYXR0ZXJuRWxlbWVudChlbGVtLCBiaW5kaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWxlbXNbaV0gPSBlbGVtO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICB0cmFuc2Zvcm1PYmplY3RQYXR0ZXJuKG5vZGUsIGJpbmRpbmcpIHtcblxuICAgICAgICAvLyBOT1RFOiBPYmplY3RQYXR0ZXJuIGFuZCBPYmplY3RMaXRlcmFsIGFyZSBpc29tb3JwaGljXG4gICAgICAgIG5vZGUudHlwZSA9IFwiT2JqZWN0UGF0dGVyblwiO1xuXG4gICAgICAgIGxldCBwcm9wcyA9IG5vZGUucHJvcGVydGllcztcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgKytpKSB7XG5cbiAgICAgICAgICAgIGxldCBwcm9wID0gcHJvcHNbaV07XG5cbiAgICAgICAgICAgIC8vIENsZWFyIHRoZSBlcnJvciBmbGFnXG4gICAgICAgICAgICBwcm9wLmVycm9yID0gXCJcIjtcblxuICAgICAgICAgICAgc3dpdGNoIChwcm9wLnR5cGUpIHtcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJQcm9wZXJ0eURlZmluaXRpb25cIjpcblxuICAgICAgICAgICAgICAgICAgICAvLyBSZXBsYWNlIG5vZGVcbiAgICAgICAgICAgICAgICAgICAgcHJvcHNbaV0gPSBwcm9wID0gbmV3IEFTVC5QYXR0ZXJuUHJvcGVydHkoXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wLmV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcC5zdGFydCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3AuZW5kKTtcblxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJQYXR0ZXJuUHJvcGVydHlcIjpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZhaWwoXCJJbnZhbGlkIHBhdHRlcm5cIiwgcHJvcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcm9wLnBhdHRlcm4pIHRoaXMudHJhbnNmb3JtUGF0dGVybkVsZW1lbnQocHJvcCwgYmluZGluZyk7XG4gICAgICAgICAgICBlbHNlIHRoaXMuY2hlY2tQYXR0ZXJuVGFyZ2V0KHByb3AubmFtZSwgYmluZGluZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0cmFuc2Zvcm1QYXR0ZXJuRWxlbWVudChlbGVtLCBiaW5kaW5nKSB7XG5cbiAgICAgICAgbGV0IG5vZGUgPSBlbGVtLnBhdHRlcm47XG5cbiAgICAgICAgLy8gU3BsaXQgYXNzaWdubWVudCBpbnRvIHBhdHRlcm4gYW5kIGluaXRpYWxpemVyXG4gICAgICAgIGlmIChub2RlICYmIG5vZGUudHlwZSA9PT0gXCJBc3NpZ25tZW50RXhwcmVzc2lvblwiICYmIG5vZGUub3BlcmF0b3IgPT09IFwiPVwiKSB7XG5cbiAgICAgICAgICAgIGVsZW0uaW5pdGlhbGl6ZXIgPSBub2RlLnJpZ2h0O1xuICAgICAgICAgICAgZWxlbS5wYXR0ZXJuID0gbm9kZSA9IG5vZGUubGVmdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2hlY2tQYXR0ZXJuVGFyZ2V0KG5vZGUsIGJpbmRpbmcpO1xuICAgIH1cblxuICAgIHRyYW5zZm9ybUlkZW50aWZpZXIobm9kZSkge1xuXG4gICAgICAgIGxldCB2YWx1ZSA9IG5vZGUudmFsdWU7XG5cbiAgICAgICAgaWYgKGlzUmVzZXJ2ZWRXb3JkKHZhbHVlKSlcbiAgICAgICAgICAgIHRoaXMuZmFpbChcIlVuZXhwZWN0ZWQgdG9rZW4gXCIgKyB2YWx1ZSwgbm9kZSk7XG5cbiAgICAgICAgdGhpcy5jaGVja0lkZW50aWZpZXIobm9kZSk7XG4gICAgfVxuXG4gICAgdHJhbnNmb3JtRGVmYXVsdEV4cG9ydChub2RlKSB7XG5cbiAgICAgICAgbGV0IHRvVHlwZSA9IG51bGw7XG5cbiAgICAgICAgc3dpdGNoIChub2RlLnR5cGUpIHtcblxuICAgICAgICAgICAgY2FzZSBcIkNsYXNzRXhwcmVzc2lvblwiOlxuICAgICAgICAgICAgICAgIGlmIChub2RlLmlkZW50aWZpZXIpIHRvVHlwZSA9IFwiQ2xhc3NEZWNsYXJhdGlvblwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwiRnVuY3Rpb25FeHByZXNzaW9uXCI6XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuaWRlbnRpZmllcikgdG9UeXBlID0gXCJGdW5jdGlvbkRlY2xhcmF0aW9uXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9UeXBlKSB7XG5cbiAgICAgICAgICAgIG5vZGUudHlwZSA9IHRvVHlwZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxufVxuXG4iXX0=