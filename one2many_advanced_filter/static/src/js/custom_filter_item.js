odoo.define("one2many_advanced_filter.One2ManyAdvancedFilterItem", function (require) {
    "use strict";

    const {DatePicker, DateTimePicker} = require("web.DatePickerOwl");
    const Domain = require("web.Domain");
    const DropdownMenuItem = require("web.DropdownMenuItem");
    const {FIELD_OPERATORS, FIELD_TYPES} = require("web.searchUtils");
    const field_utils = require("web.field_utils");
    const patchMixin = require("web.patchMixin");
    const core = require("web.core");

    /**
     * Filter generator menu
     *
     * Component which purpose is to generate new filters from a set of inputs.
     * It is made of one or several `condition` objects that will be used to generate
     * filters which will be added in the filter menu. Each condition is composed
     * of 2, 3 or 4 inputs:
     *
     * 1. FIELD (select): the field used to form the base of the domain condition;
     *
     * 2. OPERATOR (select): the symbol determining the operator(s) of the domain
     *                       condition, linking the field to one or several value(s).
     *                       Some operators can have pre-defined values that will replace user inputs.
     *                       @see searchUtils for the list of operators.
     *
     * 3. [VALUE] (input|select): the value of the domain condition. it will be parsed
     *                            according to the selected field's type. Note that
     *                            it is optional as some operators have defined values.
     *                            The generated condition domain will be as following:
     *                            [
     *                                [field, operator, (operator_value|input_value)]
     *                            ]
     *
     * 4. [VALUE] (input): for now, only date-typed fields with the 'between' operator
     *                     allow for a second value. The given input values will then
     *                     be taken as the borders of the date range (between x and y)
     *                     and will be translated as the following domain form:
     *                     [
     *                         [date_field, '>=', x],
     *                         [date_field, '<=', y],
     *                     ]
     * @extends DropdownMenuItem
     */
    class One2ManyAdvancedFilterItem extends DropdownMenuItem {
        constructor() {
            super(...arguments);

            this.canBeOpened = true;
            this.state.conditions = [];
            // Format, filter and sort the fields props
            this.fields = this._formatFields(this.props.fields);
            this.fields = Object.values(this.fields)
                .filter((field) => this._validateField(field))
                .concat({string: "ID", type: "id", name: "id"})
                .sort(({string: a}, {string: b}) => (a > b ? 1 : a < b ? -1 : 0));

            // Give access to constants variables to the template.
            // this.DECIMAL_POINT = this.env._t.database.parameters.decimal_point;
            this.OPERATORS = FIELD_OPERATORS;
            this.FIELD_TYPES = FIELD_TYPES;

            // Add default empty condition
            this._addDefaultCondition();
        }
        _formatFields(fields) {
            const formattedFields = {};
            for (const fieldName in fields) {
                formattedFields[fieldName] = Object.assign(
                    {
                        description: fields[fieldName].string,
                        name: fieldName,
                    },
                    fields[fieldName]
                );
            }
            return formattedFields;
        }

        // ---------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------

        /**
         * Populate the conditions list with a default condition having as properties:
         * - the first available field
         * - the first available operator
         * - a null or empty array value
         * @private
         */
        _addDefaultCondition() {
            const condition = {
                field: 0,
                operator: 0,
            };
            this._setDefaultValue(condition);
            this.state.conditions.push(condition);
        }

        /**
         * @private
         * @param {Object} field
         * @returns {Boolean}
         */
        _validateField(field) {
            return (
                !field.deprecated &&
                field.searchable &&
                FIELD_TYPES[field.type] &&
                field.name !== "id"
            );
        }

        /**
         * @private
         * @param {Object} condition
         */
        _setDefaultValue(condition) {
            const fieldType = this.fields[condition.field].type;
            const genericType = FIELD_TYPES[fieldType];
            const operator = FIELD_OPERATORS[genericType][condition.operator];
            switch (genericType) {
                case "id":
                case "number":
                    condition.value = 0;
                    break;
                case "date":
                    condition.value = [moment()];
                    if (operator.symbol === "between") {
                        condition.value.push(moment());
                    }
                    break;
                case "datetime":
                    condition.value = [moment("00:00:00", "hh:mm:ss")];
                    if (operator.symbol === "between") {
                        condition.value.push(moment("23:59:59", "hh:mm:ss"));
                    }
                    break;
                case "selection":
                    const [firstValue] = this.fields[condition.field].selection[0];
                    condition.value = firstValue;
                    break;
                default:
                    condition.value = "";
            }
        }

        // ---------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------

        /**
         * Convert all conditions to prefilters.
         * @private
         */
        _onApply() {
            const preFilters = this.state.conditions.map((condition) => {
                const field = this.fields[condition.field];
                const type = this.FIELD_TYPES[field.type];
                const operator = this.OPERATORS[type][condition.operator];
                const descriptionArray = [field.string, operator.description];
                const domainArray = [];
                let domainValue = null;
                // Field type specifics
                if ("value" in operator) {
                    domainValue = [operator.value];
                    // No description to push here
                } else if (["date", "datetime"].includes(type)) {
                    domainValue = condition.value.map((val) =>
                        field_utils.parse[type](val, {type}, {timezone: true})
                    );
                    const dateValue = condition.value.map((val) =>
                        field_utils.format[type](val, {type}, {timezone: false})
                    );
                    descriptionArray.push(
                        `"${dateValue.join(" " + this.env._t("and") + " ")}"`
                    );
                } else {
                    domainValue = [condition.value];
                    descriptionArray.push(`"${condition.value}"`);
                }
                // Operator specifics
                if (operator.symbol === "between") {
                    domainArray.push(
                        [field.name, ">=", domainValue[0]],
                        [field.name, "<=", domainValue[1]]
                    );
                } else {
                    domainArray.push([field.name, operator.symbol, domainValue[0]]);
                }
                const preFilter = {
                    description: descriptionArray.join(" "),
                    domain: Domain.prototype.arrayToString(domainArray),
                    type: "filter",
                };
                return preFilter;
            });
            // This.model.dispatch('createNewFilters', preFilters);
            // Reset state
            this.state.open = false;
            this.state.conditions = [];
            this._addDefaultCondition();
            core.bus.trigger("one2many_apply_filter", preFilters);
        }

        /**
         * @private
         * @param {Object} condition
         * @param {Number} valueIndex
         * @param {OwlEvent} ev
         */
        _onDateChanged(condition, valueIndex, ev) {
            condition.value[valueIndex] = ev.detail.date;
        }

        /**
         * @private
         * @param {Object} condition
         * @param {Event} ev
         */
        _onFieldSelect(condition, ev) {
            Object.assign(condition, {
                field: ev.target.selectedIndex,
                operator: 0,
            });
            this._setDefaultValue(condition);
        }

        /**
         * @private
         * @param {Object} condition
         * @param {Event} ev
         */
        _onOperatorSelect(condition, ev) {
            condition.operator = ev.target.selectedIndex;
            this._setDefaultValue(condition);
        }

        /**
         * @private
         * @param {Object} condition
         */
        _onRemoveCondition(conditionIndex) {
            this.state.conditions.splice(conditionIndex, 1);
        }

        /**
         * @private
         * @param {Object} condition
         * @param {Event} ev
         */
        _onValueInput(condition, ev) {
            const type = this.fields[condition.field].type;
            if (["float", "integer", "id"].includes(type)) {
                const previousValue = condition.value;
                const parser =
                    field_utils.parse[type === "float" ? "float" : "integer"];
                try {
                    const parsed = parser(ev.target.value || 0);
                    // Force parsed value in the input.
                    ev.target.value = condition.value = parsed || 0;
                } catch (err) {
                    // Force previous value if non-parseable.
                    ev.target.value = previousValue || 0;
                }
            } else {
                condition.value = ev.target.value || "";
            }
        }
    }

    One2ManyAdvancedFilterItem.components = {DatePicker, DateTimePicker};
    One2ManyAdvancedFilterItem.props = {
        fields: Object,
    };
    One2ManyAdvancedFilterItem.defaultProps = {
        fields: {},
    };
    One2ManyAdvancedFilterItem.template = "one2many_advanced_filter.CustomFilterItem";

    return patchMixin(One2ManyAdvancedFilterItem);
});
