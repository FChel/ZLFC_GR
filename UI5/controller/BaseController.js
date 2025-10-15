sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox"
	], function (Controller, UIComponent, JSONModel, MessageBox) {
	"use strict";

	return Controller.extend("au.gov.defence.roman.zfss.gr.controller.BaseController", {
		/**
		 * Convenience method for accessing the router.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter : function () {
			return UIComponent.getRouterFor(this);
		},

		/**
		 * Convenience method for getting the view model by name.
		 * @public
		 * @param {string} [sName] the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel : function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel : function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Getter for the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle : function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/* =========================================================== */
		/* user info popover                                           */
		/* =========================================================== */

		/**
		 * 
		 */
		onToggleUserPopover: function (oEvent) {
			if (! this.oUserPopover) {
				this.oUserPopover = sap.ui.xmlfragment("au.gov.defence.roman.zfss.gr.view.UserPopover", this);
				this.getView().addDependent(this.oUserPopover);
			}
			if (this.oUserPopover.isOpen() ) { 
				this.oUserPopover.close();
			} else {
				this.oUserPopover.openBy(oEvent.getSource());
			}
		},		

		/* =========================================================== */
		/* messaging methods                                           */
		/* =========================================================== */

		/**
		 * 
		 */
		registerMessageManager: function() {
			// set message model
			var oMessageManager = sap.ui.getCore().getMessageManager();
			this.setModel(oMessageManager.getMessageModel(), "message");
			oMessageManager.registerObject(this.getView(), true);  			
		},

		/**
		 * 
		 */
		getMessagePopover : function () {
			// create popover lazily (singleton)
			if (!this._oMessagePopover) {
				this._oMessagePopover = sap.ui.xmlfragment(this.getView().getId(), "au.gov.defence.roman.zfss.gr.view.MessagePopover", this);
				this.getView().addDependent(this._oMessagePopover);
			}
			return this._oMessagePopover;
		},

		/**
		 * 
		 */
		onMessagePopoverPress : function (oEvent) {
			this.getMessagePopover().openBy(oEvent.getSource());
		},

		/**
		 * Return the button type according to the message with the highest severity
		 * Error > Warning > Success > Info
		 */
		getMessageButtonType: function () {
			var sHighestSeverity = "Ghost";
			var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().oData;

			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
				case "Error":
					sHighestSeverity = "Reject";
					break;
				case "Warning":
					sHighestSeverity = sHighestSeverity !== "Reject" ? "Emphasized" : sHighestSeverity;
					break;
				case "Success":
					sHighestSeverity = sHighestSeverity !== "Reject" && sHighestSeverity !== "Emphasized" ?  "Accept" : sHighestSeverity;
					break;
				default:
					sHighestSeverity = !sHighestSeverity ? "Ghost" : sHighestSeverity;
				break;
				}
			});

			return sHighestSeverity;
		},		

		/**
		 * Return the button icon according to the message with the highest severity
		 * Error > Warning > Success > Info
		 */
		getMessageButtonIcon: function () {
			var sIcon = "sap-icon://warning2";
			var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().oData;

			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
				case "Error":
					sIcon = "sap-icon://error";
					break;
				case "Warning":
					sIcon = sIcon !== "sap-icon://error" ? "sap-icon://alert" : sIcon;
					break;
				case "Success":
					sIcon = "sap-icon://error" && sIcon !== "sap-icon://alert" ? "sap-icon://message-success" : sIcon;
					break;
				default:
					sIcon = !sIcon ? "sap-icon://warning2" : sIcon;
				break;
				}
			});

			return sIcon;
		},		

		/* =========================================================== */
		/* navigation methods                                          */
		/* =========================================================== */	        

		/**
		 * 
		 */
		onNavBack: function() {
			history.go(-1);			
		},

		/**
		 * Event handler for navigating to landing page
		 * @public
		 */
		onNavHome: function() {				
			var bFLP = this.getModel("componentModel").getProperty("/inFLP");			
			if (bFLP === true) {
				sap.ushell.Container.getService("CrossApplicationNavigation").toExternal({
					target: {
						shellHash: "#Shell-home"
					}
				});
			} else {
				window.location.replace("../../../bsp/sap/zfss_myfi/buypayorder.html");	
			}
		},

		/**
		 * Event handler for navigating to landing page
		 * @public
		 */
		onNavHelp: function() {
			var sHelpUrl = this.getModel("userModel").getData().HelpUrl;
			sap.m.URLHelper.redirect(sHelpUrl, true);
		},		

		/**
		 * Navigate to PO display app
		 */
		onPOLinkPress: function(oEvent) {
		    var oBindingContext = this.getView().getBindingContext();
		    var sPoNumber = oBindingContext.getProperty("PoNumber");
		    
		    if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
		        var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
		        
		        // Get the URL for external navigation
		        var sHash = oCrossAppNavigator.hrefForExternal({
		            target: {
		                semanticObject: "PurchaseOrder",
		                action: "displayFactSheet"
		            },
		            params: {
		                "PurchaseOrder": sPoNumber
		            }
		        });
		        
		        // Open in new tab
		        var sUrl = window.location.href.split('#')[0] + sHash;
		        window.open(sUrl, '_blank');
		    }
		},
		
		onVendorLinkPress: function(oEvent) {
		    var oBindingContext = this.getView().getBindingContext();
		    var sVendor = oBindingContext.getProperty("Vendor");
		    
		    if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
		        var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
		        
		        var sHash = oCrossAppNavigator.hrefForExternal({
		            target: {
		                semanticObject: "Supplier",
		                action: "display"
		            },
		            params: {
		                "Supplier": sVendor
		            }
		        });
		        
		        // Open in new tab
		        var sUrl = window.location.href.split('#')[0] + sHash;
		        window.open(sUrl, '_blank');
		    }
		},		
		
		/* =========================================================== */
		/* validation methods                                          */
		/* =========================================================== */	 		

		/**
		 *
		 */
		isNumber: function (n) {
			return !isNaN(parseFloat(n)) && isFinite(n);
		},

		/**
		 * 
		 */
		isValidDate: function (sDate) {				
			var Day = sDate.substr(0,2);
			var Mn = sDate.substr(3,2);
			var Yr = sDate.substr(6,4);

			var DateVal = Mn + "/" + Day + "/" + Yr;
			var dt = new Date(DateVal);

			if(dt.getDate()!=Day){
				return(false);
			}
			else if(dt.getMonth()!=Mn-1){
				return(false);
			}
			else if(dt.getFullYear()!=Yr){
				return(false);
			}

			return(true);		
		},

		/* =========================================================== */
		/* po/gr commonethods                                          */
		/* =========================================================== */

	});

});