odoo.define("one2many_delete_confirm", function (require) {
    "use strict";

    const ListRenderer = require("web.ListRenderer");
    const FieldOne2Many = require("web.relational_fields").FieldOne2Many;
    const fieldRegistry = require("web.field_registry");
    const core = require("web.core");
    const _t = core._t;
    const Dialog = require("web.Dialog");

    const DeleteConfirmRenderer = ListRenderer.extend({
        _one2manyRemoveConfirm: function (event) {
            event.stopPropagation();
            const $row = $(event.target).closest("tr");
            const id = $row.data("id");
            if ($row.hasClass("o_selected_row")) {
                this.trigger_up("list_record_remove", {id: id});
            } else {
                this.unselectRow().then(() => {
                    this.trigger_up("list_record_remove", {id: id});
                });
            }
        },
        _onRemoveIconClick: function (event) {
            event.stopPropagation();
            const self = this;
            const buttons = [
                {
                    text: _t("Aceptar"),
                    classes: "btn-primary o_adyen_confirm",
                    close: true,
                    click: function () {
                        this.close();
                        self._one2manyRemoveConfirm(event);
                    },
                },
                {
                    text: _t("Cancelar"),
                    close: true,
                },
            ];

            const dialog = new Dialog(this, {
                size: "small",
                buttons: buttons,
                title: _t("Confirmación"),
                // Size: 'medium',
                $content:
                    "<p>" +
                    _t(
                        "Está seguro que desea eliminar el registro? Esta acción tambien eliminará todas sus subentidades asociadas."
                    ) +
                    "</p>",
            });
            dialog.open();
        },
    });

    const DeleteConfirmFieldOne2Many = FieldOne2Many.extend({
        _getRenderer: function () {
            return DeleteConfirmRenderer;
        },
    });

    fieldRegistry.add("delete_confirm_one2many", DeleteConfirmFieldOne2Many);
});
