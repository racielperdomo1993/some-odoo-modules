import json

from odoo import http


class One2ManyAdvancedFilterController(http.Controller):
    @http.route(
        ["/one2many_advanced_filter/process_filters"],
        type="json",
        auth="user",
        website=True,
    )
    def process_filters(self, prefilters, res_ids, model):
        domain = [("id", "in", res_ids)] + list(
            map(lambda r: tuple(json.loads(r["domain"])[0]), prefilters)
        )
        records = http.request.env[model].search(domain)
        return records.ids
