odoo.define("one2many_advanced_filter.filter", function (require) {
    "use strict";

    const One2ManyAdvancedFilterItem = require("one2many_advanced_filter.One2ManyAdvancedFilterItem");
    const core = require("web.core");
    const FieldOne2Many = require("web.relational_fields").FieldOne2Many;
    const FieldX2Many = require("web.relational_fields").FieldX2Many;
    const {ComponentWrapper} = require("web.OwlCompatibility");
    const ControlPanelX2Many = require("web.ControlPanelX2Many");
    const rpc = require("web.rpc");

    FieldX2Many.include({
        start: async function () {
            const _super = this._super.bind(this);
            const result = _super(...arguments);
            if (this.view) {
                this._renderButtons();
                if (
                    this.field.views !== undefined &&
                    this.field.views.tree !== undefined
                ) {
                    await this._controlPanelWrapper.destroy();
                    this._controlPanelWrapper = new ComponentWrapper(
                        this,
                        ControlPanelX2Many,
                        {
                            cp_content: {$buttons: this.$buttons},
                            pager: this.pagingState,
                            fields: this.field.views.tree.fields,
                        }
                    );
                    await this._controlPanelWrapper.mount(this.el, {
                        position: "first-child",
                    });
                }
            }
            return result;
        },
    });

    FieldOne2Many.include({
        filter_object: function (data) {
            this.value.data = _.filter(
                this.value.data,
                (r) => data.indexOf(r.res_id) != -1
            );
            this.value.res_ids = data;
            this.value.count = this.value.res_ids.length;
        },
        one2many_apply_filter: function (preFilters) {
            rpc.query({
                route: "/one2many_advanced_filter/process_filters",
                params: {
                    prefilters: preFilters,
                    res_ids: this.value.res_ids,
                    model: this.value.model,
                },
            }).then((data) => {
                if (data.length == 0) return;
                this.filter_object(data);
                this._render();
            });
        },
        init: function () {
            this._super.apply(this, arguments);
            core.bus.on("one2many_apply_filter", this, this.one2many_apply_filter);
        },
    });

    const components = {
        ControlPanelX2Many: require("web.ControlPanelX2Many"),
    };

    Object.assign(components.ControlPanelX2Many, {
        components: Object.assign({}, components.ControlPanelX2Many.components, {
            One2ManyAdvancedFilterItem,
        }),
        props: Object.assign({}, components.ControlPanelX2Many.props, {
            fields: Object,
        }),
        defaultProps: Object.assign({}, components.ControlPanelX2Many.defaultProps, {
            fields: {},
        }),
    });
});
