sap.ui.define([], function () {
	"use strict";

	return {
		
		/**
		 * Returns GR page title based on edit mode flag
		 */
		grPageTitle: function (bEditMode) {
			var oResourceBundle = this.getResourceBundle();

			if (bEditMode) {
				return oResourceBundle.getText("grEditTitle");
			} else {
				return oResourceBundle.getText("grDisplayTitle");
			}
		},
		
		/**
		 * 
		 */
		removeLeadingZero: function (sValue) {
			return sValue ? sValue.replace(/^0+/, '') : "";
		},
		
		/**
		 * 
		 */
		currencyValue : function (sValue, currency) {
			var temp = sValue;
			if (!temp) {
				temp = 0;
			}
			if(currency){
				var oLocale = new sap.ui.core.Locale("en-AU");
				var oFormatOptions = {
				    showMeasure: false,
				    currencyCode: true,
				    currencyContext: "standard"};
				var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance(oFormatOptions, oLocale);
				return oCurrencyFormat.format(temp, currency); 
			}

			return parseFloat(temp).toFixed(2);
		},		
		
		/**
		 * 
		 */
		netPriceFormatter: function(netPrice, currency, unitPrice, unitQty){
			var amount = (netPrice === undefined || netPrice === null || netPrice <= 0) ? 
							unitPrice * unitQty : 
							netPrice;
			return this.formatter.currencyValue(amount, currency);
		},
		
		/**
		 * 
		 */
		poLinkHtml: function(sPoNumber, bIsMyFi) {
			if (sPoNumber) {
				//if (bIsMyFi) {
				//	var sHrefPrefix = "<a href='../zfss_ssp/index.html#/PO/" + sPoNumber + "'>";
				//	return sHrefPrefix + sPoNumber + "</a> " + sHrefPrefix + "<span class='sapiconfont'>\ue0ac</span></a>";
				//} else {
					return sPoNumber;
				//}
			} else {
				return "";
			}
				
		}		
		
	};

});