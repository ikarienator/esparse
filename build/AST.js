"use strict";

// istanbul ignore next
var _defaults = function (obj, defaults) { var keys = Object.getOwnPropertyNames(defaults); for (var i = 0; i < keys.length; i++) { var key = keys[i]; var value = Object.getOwnPropertyDescriptor(defaults, key); if (value && value.configurable && obj[key] === undefined) { Object.defineProperty(obj, key, value); } } return obj; };

// istanbul ignore next
var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

// istanbul ignore next
var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

/*

NOTE: We forego using classes and class-based inheritance because at this time
super() tends to be slow in transpiled code.  Instead, we use regular constructor
functions and give them a common prototype property.

*/

var _NodesJs = require("./Nodes.js");

var Nodes = _NodesJs;
_defaults(exports, _NodesJs);

function isNode(x) {
    return x !== null && typeof x === "object" && typeof x.type === "string";
}

var NodeBase = (function () {
    function NodeBase() {
        _classCallCheck(this, NodeBase);
    }

    _prototypeProperties(NodeBase, null, {
        children: {
            value: function children() {
                var keys = Object.keys(this),
                    list = [];

                for (var i = 0; i < keys.length; ++i) {
                    if (keys[i] === "parent") break;

                    var value = this[keys[i]];

                    if (Array.isArray(value)) {
                        for (var j = 0; j < value.length; ++j) if (isNode(value[j])) list.push(value[j]);
                    } else if (isNode(value)) {
                        list.push(value);
                    }
                }

                return list;
            },
            writable: true,
            configurable: true
        }
    });

    return NodeBase;
})();

Object.keys(Nodes).forEach(function (k) {
    return Nodes[k].prototype = NodeBase.prototype;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9BU1QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozt1QkFRdUIsWUFBWTs7SUFBdkIsS0FBSzs7O0FBR2pCLFNBQVMsTUFBTSxDQUFDLENBQUMsRUFBRTtBQUVmLFdBQU8sQ0FBQyxLQUFLLElBQUksSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQztDQUM1RTs7SUFFSyxRQUFRO2FBQVIsUUFBUTs4QkFBUixRQUFROzs7eUJBQVIsUUFBUTtBQUVWLGdCQUFRO21CQUFBLG9CQUFHO0FBRVAsb0JBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO29CQUN4QixJQUFJLEdBQUcsRUFBRSxDQUFDOztBQUVkLHFCQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtBQUVsQyx3QkFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxFQUNwQixNQUFNOztBQUVWLHdCQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRTFCLHdCQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFFdEIsNkJBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUNqQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztxQkFFL0IsTUFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUV0Qiw0QkFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztxQkFDcEI7aUJBQ0o7O0FBRUQsdUJBQU8sSUFBSSxDQUFDO2FBQ2Y7Ozs7OztXQTNCQyxRQUFROzs7QUErQmQsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDO1dBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsU0FBUztDQUFBLENBQUMsQ0FBQyIsImZpbGUiOiJzcmMvQVNULmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcblxuTk9URTogV2UgZm9yZWdvIHVzaW5nIGNsYXNzZXMgYW5kIGNsYXNzLWJhc2VkIGluaGVyaXRhbmNlIGJlY2F1c2UgYXQgdGhpcyB0aW1lXG5zdXBlcigpIHRlbmRzIHRvIGJlIHNsb3cgaW4gdHJhbnNwaWxlZCBjb2RlLiAgSW5zdGVhZCwgd2UgdXNlIHJlZ3VsYXIgY29uc3RydWN0b3JcbmZ1bmN0aW9ucyBhbmQgZ2l2ZSB0aGVtIGEgY29tbW9uIHByb3RvdHlwZSBwcm9wZXJ0eS5cblxuKi9cblxuaW1wb3J0ICogYXMgTm9kZXMgZnJvbSBcIi4vTm9kZXMuanNcIjtcbmV4cG9ydCAqIGZyb20gXCIuL05vZGVzLmpzXCI7XG5cbmZ1bmN0aW9uIGlzTm9kZSh4KSB7XG5cbiAgICByZXR1cm4geCAhPT0gbnVsbCAmJiB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgeC50eXBlID09PSBcInN0cmluZ1wiO1xufVxuXG5jbGFzcyBOb2RlQmFzZSB7XG5cbiAgICBjaGlsZHJlbigpIHtcblxuICAgICAgICBsZXQga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMpLFxuICAgICAgICAgICAgbGlzdCA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuXG4gICAgICAgICAgICBpZiAoa2V5c1tpXSA9PT0gXCJwYXJlbnRcIilcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpc1trZXlzW2ldXTtcblxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHZhbHVlLmxlbmd0aDsgKytqKVxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNOb2RlKHZhbHVlW2pdKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaCh2YWx1ZVtqXSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNOb2RlKHZhbHVlKSkge1xuXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgIH1cblxufVxuXG5PYmplY3Qua2V5cyhOb2RlcykuZm9yRWFjaChrID0+IE5vZGVzW2tdLnByb3RvdHlwZSA9IE5vZGVCYXNlLnByb3RvdHlwZSk7XG4iXX0=
