odoo.define('pos_absolute_discount.models', function(require){

    var models = require('point_of_sale.models');
    var utils = require('web.utils');

    var round_pr = utils.round_precision;


    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr,options){
            this.absolute_discount = 0;
            _super_orderline.initialize.apply(this, arguments);
        },
        init_from_JSON: function(json) {
            _super_orderline.init_from_JSON.apply(this, arguments);
            if (json.absolute_discount) {
                this.set_absolute_discount(json.absolute_discount);
            }
        },
        set_discount: function (discount) {
            if (this.get_absolute_discount()) {
                this.set_absolute_discount(0);
            }
            _super_orderline.set_discount.apply(this, arguments);
        },
        // sets a absolute discount
        set_absolute_discount: function (discount) {
            var rounding = this.pos.currency.rounding;
            discount = round_pr(discount, rounding);
            if (this.get_discount()) {
                this.set_discount(0);
            }
            this.absolute_discount = discount || 0;
            this.absolute_discountStr = String(this.absolute_discount);
            this.trigger('change',this);
        },
        // returns the absolute discount
        get_absolute_discount: function(){
            return this.absolute_discount;
        },
        get_absolute_discount_str: function(){
            return this.absolute_discountStr;
        },
        set_quantity: function(quantity){
            var self = this;
            var absolute_discount = this.get_absolute_discount() / this.quantity;
            _super_orderline.set_quantity.call(this, quantity);
            if(quantity !== 'remove' && absolute_discount){
                var qty = parseFloat(quantity) || 0;
                this.set_absolute_discount(absolute_discount * qty);
            }
        },
        clone: function(){
            var res = _super_orderline.clone.apply(this, arguments);
            res.absolute_discount = this.absolute_discount;
            return res;
        },
        // when we add an new orderline we want to merge it with the last line to see reduce the number of items
        // in the orderline. This returns true if it makes sense to merge the two
        can_be_merged_with: function(orderline){
            // we don't merge discounted orderlines
            if (this.get_absolute_discount() > 0) {
                return false;
            }
            return _super_orderline.can_be_merged_with.apply(this, arguments);
        },
        export_as_JSON:function(){
            var res = _super_orderline.export_as_JSON.apply(this, arguments);
            res.absolute_discount = this.get_absolute_discount();
            res.absolute_discountStr = this.get_absolute_discount_str();
            return res;
        },
        //used to create a json of the ticket, to be sent to the printer
        export_for_printing: function(){
            var res = _super_orderline.export_for_printing.apply(this, arguments);
            res.absolute_discount = this.get_absolute_discount();
            res.absolute_discountStr = this.get_absolute_discount_str();
            return res;
        },
        get_base_price: function(){
            var rounding = this.pos.currency.rounding;
            if (this.get_absolute_discount()) {
                return round_pr(((this.get_unit_price() * this.get_quantity()) - this.get_absolute_discount()), rounding);
            }
            return _super_orderline.get_base_price.apply(this, arguments);
        },
        get_all_prices: function(){
            var res = _super_orderline.get_all_prices.apply(this, arguments);
            if (this.get_absolute_discount()) {
                var price_unit = this.get_unit_price() - (this.get_absolute_discount() / this.get_quantity());
                var taxtotal = 0;

                var product = this.get_product();
                var taxes_ids = product.taxes_id;
                var taxes = this.pos.taxes;
                var taxdetail = {};
                var product_taxes = [];

                _(taxes_ids).each(function(el){
                    product_taxes.push(_.detect(taxes, function(t){
                        return t.id === el;
                    }));
                });

                var all_taxes = this.compute_all(product_taxes, price_unit, this.get_quantity(), this.pos.currency.rounding);
                _(all_taxes.taxes).each(function(tax) {
                    taxtotal += tax.amount;
                    taxdetail[tax.id] = tax.amount;
                });
                res.priceWithTax = all_taxes.total_included;
                res.priceWithoutTax = all_taxes.total_excluded;
                res.tax = taxtotal;
                res.taxDetails = taxdetail;
            }
            return res;
        },
    });
    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        add_product: function(product, options){
            _super_order.add_product.apply(this, arguments);
            var line = this.get_selected_orderline();
            if(line && options && typeof options.absolute_discount !== "undefined"){
                line.set_absolute_discount(options.absolute_discount);
            }
        },
        get_total_absolute_discount: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                return sum + orderLine.get_absolute_discount();
            }), 0), this.pos.currency.rounding);
        },
        get_total_discount: function() {
            return _super_order.get_total_discount.apply(this, arguments) + this.get_total_absolute_discount();
        }
    });
    var _super_numpad = models.NumpadState.prototype;
    models.NumpadState = models.NumpadState.extend({
        changeMode: function(newMode) {
            if (newMode === 'discount') {
                this.trigger('change:discount', this);
            }
            _super_numpad.changeMode.apply(this, arguments);
        },
    });
    return models;
});