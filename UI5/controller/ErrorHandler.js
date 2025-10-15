sap.ui.define([
	"sap/ui/base/Object",
	"sap/m/MessageBox"
], function (UI5Object, MessageBox) {
	"use strict";

	return UI5Object.extend("au.gov.defence.roman.zfss.gr.controller.ErrorHandler", {

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias au.gov.defence.roman.zfss.gr.controller.ErrorHandler
		 */
		constructor : function (oComponent) {
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this._oModel = oComponent.getModel();
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorText");

			this._oModel.attachMetadataFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				this._showServiceError(oParams.response);
			}, this);

			this._oModel.attachRequestFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				// An entity that was not found in the service is also throwing a 404 error in oData.
				// We already cover this case with a notFound target so we skip it here.
				// A request that cannot be sent to the server is a technical error that we have to handle though
				if (oParams.response.statusCode !== "404" || (oParams.response.statusCode === 404 && oParams.response.responseText.indexOf("Cannot POST") === 0)) {
					this._showServiceError(oParams.response);
				}
			}, this);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showServiceError : function (sDetails) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			
			var oResBody;
			var sContentType = sDetails.headers["Content-Type"];
			if (sContentType.includes("application/json")) {
				oResBody = JSON.parse(sDetails.responseText);
			}
						
			var sText = "";
			var sTitle = "Error";
			var iErr = sDetails.statusCode;
			
			if (oResBody){
				sText = oResBody.error.message.value;
			} else {
				sText = this._sErrorText;
			}
			
			var oFormattedText = new sap.m.FormattedText("FormattedText", { htmlText: sText });
			MessageBox.error(
				oFormattedText, {
					title : sTitle,
					id : "serviceErrorMessageBox",
					details : sDetails,
					styleClass : this._oComponent.getContentDensityClass(),
					actions : [MessageBox.Action.CLOSE],
					onClose : function () {
						this._bMessageOpen = false;
						if (this._oComponent.oBusyDialog) {
							this._oComponent.oBusyDialog.close();						
						}
					}.bind(this)
				}
			);
		}
	});
});