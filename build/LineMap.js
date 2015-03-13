"use strict";

// istanbul ignore next
var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

// istanbul ignore next
var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// Performs a binary search on an array
function binarySearch(array, val) {
    var right = array.length - 1,
        left = 0;

    while (left <= right) {
        var mid = left + right >> 1,
            test = array[mid];

        if (val === test) {
            return mid;
        }if (val < test) right = mid - 1;else left = mid + 1;
    }

    return left;
}

var LineMap = exports.LineMap = (function () {
    function LineMap() {
        _classCallCheck(this, LineMap);

        this.lines = [-1];
        this.lastLineBreak = -1;
    }

    _prototypeProperties(LineMap, null, {
        addBreak: {
            value: function addBreak(offset) {
                if (offset > this.lastLineBreak) this.lines.push(this.lastLineBreak = offset);
            },
            writable: true,
            configurable: true
        },
        locate: {
            value: function locate(offset) {
                var line = binarySearch(this.lines, offset),
                    pos = this.lines[line - 1],
                    column = offset - pos;

                return { line: line, column: column, lineOffset: pos + 1 };
            },
            writable: true,
            configurable: true
        }
    });

    return LineMap;
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9MaW5lTWFwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUNBLFNBQVMsWUFBWSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFFOUIsUUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDO1FBQ3hCLElBQUksR0FBRyxDQUFDLENBQUM7O0FBRWIsV0FBTyxJQUFJLElBQUksS0FBSyxFQUFFO0FBRWxCLFlBQUksR0FBRyxHQUFHLEFBQUMsSUFBSSxHQUFHLEtBQUssSUFBSyxDQUFDO1lBQ3pCLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7O0FBRXRCLFlBQUksR0FBRyxLQUFLLElBQUk7QUFDWixtQkFBTyxHQUFHLENBQUM7U0FBQSxBQUVmLElBQUksR0FBRyxHQUFHLElBQUksRUFBRSxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUMzQixJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztLQUN2Qjs7QUFFRCxXQUFPLElBQUksQ0FBQztDQUNmOztJQUVZLE9BQU8sV0FBUCxPQUFPO0FBRUwsYUFGRixPQUFPOzhCQUFQLE9BQU87O0FBSVosWUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEIsWUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQztLQUMzQjs7eUJBTlEsT0FBTztBQVFoQixnQkFBUTttQkFBQSxrQkFBQyxNQUFNLEVBQUU7QUFFYixvQkFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsQ0FBQzthQUNwRDs7OztBQUVELGNBQU07bUJBQUEsZ0JBQUMsTUFBTSxFQUFFO0FBRVgsb0JBQUksSUFBSSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztvQkFDdkMsR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztvQkFDMUIsTUFBTSxHQUFHLE1BQU0sR0FBRyxHQUFHLENBQUM7O0FBRTFCLHVCQUFPLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxNQUFNLEVBQU4sTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUM7YUFDaEQ7Ozs7OztXQXJCUSxPQUFPIiwiZmlsZSI6InNyYy9MaW5lTWFwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gUGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoIG9uIGFuIGFycmF5XG5mdW5jdGlvbiBiaW5hcnlTZWFyY2goYXJyYXksIHZhbCkge1xuXG4gICAgbGV0IHJpZ2h0ID0gYXJyYXkubGVuZ3RoIC0gMSxcbiAgICAgICAgbGVmdCA9IDA7XG5cbiAgICB3aGlsZSAobGVmdCA8PSByaWdodCkge1xuXG4gICAgICAgIGxldCBtaWQgPSAobGVmdCArIHJpZ2h0KSA+PiAxLFxuICAgICAgICAgICAgdGVzdCA9IGFycmF5W21pZF07XG5cbiAgICAgICAgaWYgKHZhbCA9PT0gdGVzdClcbiAgICAgICAgICAgIHJldHVybiBtaWQ7XG5cbiAgICAgICAgaWYgKHZhbCA8IHRlc3QpIHJpZ2h0ID0gbWlkIC0gMTtcbiAgICAgICAgZWxzZSBsZWZ0ID0gbWlkICsgMTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGVmdDtcbn1cblxuZXhwb3J0IGNsYXNzIExpbmVNYXAge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG5cbiAgICAgICAgdGhpcy5saW5lcyA9IFstMV07XG4gICAgICAgIHRoaXMubGFzdExpbmVCcmVhayA9IC0xO1xuICAgIH1cblxuICAgIGFkZEJyZWFrKG9mZnNldCkge1xuXG4gICAgICAgIGlmIChvZmZzZXQgPiB0aGlzLmxhc3RMaW5lQnJlYWspXG4gICAgICAgICAgICB0aGlzLmxpbmVzLnB1c2godGhpcy5sYXN0TGluZUJyZWFrID0gb2Zmc2V0KTtcbiAgICB9XG5cbiAgICBsb2NhdGUob2Zmc2V0KSB7XG5cbiAgICAgICAgbGV0IGxpbmUgPSBiaW5hcnlTZWFyY2godGhpcy5saW5lcywgb2Zmc2V0KSxcbiAgICAgICAgICAgIHBvcyA9IHRoaXMubGluZXNbbGluZSAtIDFdLFxuICAgICAgICAgICAgY29sdW1uID0gb2Zmc2V0IC0gcG9zO1xuXG4gICAgICAgIHJldHVybiB7IGxpbmUsIGNvbHVtbiwgbGluZU9mZnNldDogcG9zICsgMSB9O1xuICAgIH1cbn1cbiJdfQ==