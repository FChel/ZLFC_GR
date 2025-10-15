sap.ui.define([
	"./BaseController",
	"../model/formatter",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/FormattedText",
	"sap/m/MessageBox",
	"sap/ui/core/message/Message",
	"sap/ui/core/library",
	"sap/ui/events/KeyCodes",
	"sap/ui/core/syncStyleClass"
	], function (BaseController, formatter, JSONModel, Filter, FilterOperator, FormattedText, MessageBox, Message, library, KeyCodes, syncStyleClass) {
	"use strict";

	var MessageType = library.MessageType;
	var ValueState = library.ValueState;

	return BaseController.extend("au.gov.defence.roman.zfss.gr.controller.PO", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * init
		 */
		onInit: function () {

			// matched PO route
			this.getRouter().getRoute("po1").attachPatternMatched(this._onPOMatched, this);

			// no PO route (i.e. route to PO selection)
			this.getRouter().getRoute("po0").attachPatternMatched(this._onNoPO, this);

			// VIM route
			this.getRouter().getRoute("vim").attachPatternMatched(this._onVIMMatched, this);

			// message manager
			this.registerMessageManager();

			// set max date on date picker to today
			var oDP = this.byId("movtDatePicker");
			if (oDP) {
				oDP.setMaxDate(new Date());
			}
		},

		/**
		 * exit
		 */
		onExit: function () {
			if (this.oValueHelpDialog) {
				this.oValueHelpDialog.destroy();
			}
		},

  
		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * submitting data to the backend if bSubmit flag is true then post a GR otherwise validate only
		 */
		onSubmit: function () {
			var oViewModel = this.getModel("viewModel");

			// reset all errors
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var bMandatoryMissing = false;
			oViewModel.setProperty("/movtConfirmValueState", ValueState.None);
			var aItems = this.getModel("movtModel").getProperty("/");
			for (var i = 0; i < aItems.length; i++) {
				this.getModel("movtModel").setProperty("/" + i + "/PoItemVs", ValueState.None);
				this.getModel("movtModel").setProperty("/" + i + "/EntryQntVs", ValueState.None);
				this.getModel("movtModel").setProperty("/" + i + "/DocDateVs", ValueState.None);
				this.getModel("movtModel").setProperty("/" + i + "/LineStatus", MessageType.None);
			}
			this.getMessagePopover().close();

			// error check: mandatory fields & number in quantity field (needs to be checked here as it causes an oData error)
			for (var i = 0; i < aItems.length; i++) {

				if (aItems[i].PoItem === "") {
					this.getModel("movtModel").setProperty("/" + i + "/PoItemVs", ValueState.Error);
					bMandatoryMissing = true;
				} else {
					for (var j = 0; j < aItems.length; j++) {
						if (j !== i && aItems[j].PoItem === aItems[i].PoItem) {
							this._addError(this.getResourceBundle().getText("duplicatePoItemError"), "/" + j + "/PoItemVs");
						}
					}
				}

				if (aItems[i].EntryQnt === "") {
					this.getModel("movtModel").setProperty("/" + i + "/EntryQntVs", ValueState.Error);
					bMandatoryMissing = true;
				} else if (! this.isNumber(aItems[i].EntryQnt)) {
					var oMessage = new Message({
						message: this.getResourceBundle().getText("quantityNotNumberError", [aItems[i].EntryQnt]),
						type: MessageType.Error
					});
					sap.ui.getCore().getMessageManager().addMessages(oMessage);

					this.getModel("movtModel").setProperty("/" + i + "/EntryQntVs", ValueState.Error);
				}

				if (!aItems[i].DocDate) {
					this.getModel("movtModel").setProperty("/" + i + "/DocDateVs", ValueState.Error);
					bMandatoryMissing = true;
				}
			}

			if (bMandatoryMissing) {
				var oMessage = new Message({
					message: this.getResourceBundle().getText("mandatoryMissingError"),
					type: MessageType.Error
				});
				sap.ui.getCore().getMessageManager().addMessages(oMessage);
			}

			// data to be submitted
			var oBindingContext = this.getView().getBindingContext();
			var oData = this.getModel().getObject(oBindingContext.getPath(), {expand: 'Items,MaterialDocuments'});
			oData.SubmitFlag = false;
			oData.GrValue = oViewModel.getProperty("/movtTotalIncTax").toString();

			var oMovtData = this.getModel("movtModel").oData;
			oData.Movements = oMovtData;
			for (var i = 0; i < oData.Movements.length; i++) {
				if (! this.isNumber(oData.Movements[i].EntryQnt)) {
					oData.Movements[i].EntryQnt = "0";
				}
			}

			var sText = "";
			var sTitle = "";
			var oController = this;
			oViewModel.setProperty("/busy", true);

			var oModel = this.getOwnerComponent().getModel();
			oModel.create("/PurchaseOrders", oData, {
				success: function (oResult, oResponse) {
					oViewModel.setProperty("/busy", false);

					var aMovt = oResult.Movements.results;
					for (var i = 0; i < aMovt.length; i++) {
						if (aMovt[i].PoItem === "00000") {
							aMovt[i].PoItem = "";
						}
						if (aMovt[i].EntryQnt === "0.000") {
							aMovt[i].EntryQnt = "";
						}
					}
					var oMovtModel = new JSONModel();
					oMovtModel.setData(aMovt);
					oController.setModel(oMovtModel, "movtModel");

					var bError = false;
					var bDuplicateWarning = false;
					var bVimBalanceWarning = false;
					var sVimBalanceWarningMessage = "";
					var aMessage = oController.getModel("message").oData;
					for (var i = 0; i < aMessage.length; i++) {
						if (aMessage[i].type === "Error") {
							bError = true;
						}

						if (aMessage[i].code === "ZFSS_GR/003") {
							bDuplicateWarning = true;
						}

						if (aMessage[i].code === "ZFSS_GR/011") {
							bVimBalanceWarning = true;
							sVimBalanceWarningMessage = aMessage[i].message;
						}
					}

					if (bError) {
						var oButton = oController.byId("messagesButton");
						oButton.firePress(oButton);
					} else {

						if (bDuplicateWarning) {
							var sText = oController.getResourceBundle().getText("duplicateWarningText1", [oResult.MaterialDocuments.results.length]);
							for (var i = 0; i < oResult.MaterialDocuments.results.length; i++) {
								sText += "<li>" + oResult.MaterialDocuments.results[i].MatDoc + "</li>";
							}
							sText += oController.getResourceBundle().getText("duplicateWarningText2");

							var oFormattedText = new FormattedText("", { htmlText: sText });

							MessageBox.warning(oFormattedText, {
								title: oController.getResourceBundle().getText("duplicateWarningTitle"),
								initialFocus: null,
								actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
								onClose: function(sAction) {
									if (sAction === MessageBox.Action.OK) {
										if (bVimBalanceWarning) {
											oController._vimBalanceWarning(oData, sVimBalanceWarningMessage);
										} else {
											oController._confirmGRPost(oData);
										}
									}
								}
							});
						} else if (bVimBalanceWarning) {
							oController._vimBalanceWarning(oData, sVimBalanceWarningMessage);
						} else {
							oController._confirmGRPost(oData);
						}

					}

					oViewModel.setProperty("/messageButtonType", oController.getMessageButtonType());
					oViewModel.setProperty("/messageButtonIcon", oController.getMessageButtonIcon());
				},
				error: function (oError) {
					oViewModel.setProperty("/busy", false);
				}
			});
		},

		/**
		 *
		 */
		_vimBalanceWarning: function(oData, sMessage) {
			var oController = this;
			MessageBox.warning(sMessage, {
				title: this.getResourceBundle().getText("vimBalanceWarningTitle"),
				initialFocus: null,
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function(sAction) {
					if (sAction === MessageBox.Action.OK) {
						oController._confirmGRPost(oData);
					}
				}
			});
		},

		/**
		 *
		 */
		_confirmGRPost: function (oData) {
			var oController = this;
			var sText = this.getResourceBundle().getText("createConfirmText");
			var oFormattedText = new FormattedText("", { htmlText: sText });
			MessageBox.warning(oFormattedText, {
				title: this.getResourceBundle().getText("createConfirmTitle"),
				initialFocus: null,
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function(sAction) {
					if (sAction === MessageBox.Action.OK) {
						oController._postGR(oData);
					}
				}
			});
		},

		/**
		 *
		 */
		_postGR: function (oData) {
			var oViewModel = this.getModel("viewModel");
			oViewModel.setProperty("/busy", true);

			// reset all messages
			sap.ui.getCore().getMessageManager().removeAllMessages();

			oData.SubmitFlag = true;

			var oController = this;
			var oModel = this.getOwnerComponent().getModel();
			oModel.create("/PurchaseOrders", oData, {
				success: function (oResult, oResponse) {
					oViewModel.setProperty("/busy", false);

					var bError = false;
					var aMessage = oController.getModel("message").oData;
					for (var i = 0; i < aMessage.length; i++) {
						if (aMessage[i].type === "Error") {
							bError = true;
						}
					}

					if (bError) {

						var sText = oController.getResourceBundle().getText("errorText1", [oResult.MaterialDocuments.results.length, oResult.PoNumber]);
						for (var i = 0; i < aMessage.length; i++) {
							if (aMessage[i].type === "Error") {
								sText += aMessage[i].message + " (" + aMessage[i].code + ").";
							}
						}
						sText += oController.getResourceBundle().getText("errorText2");
						var oFormattedText = new FormattedText("", { htmlText: sText });

						MessageBox.error(oFormattedText, {
							title: oController.getResourceBundle().getText("errorTitle"),
							initialFocus: null
						});

					} else {
						oViewModel.setProperty("/posted", true);
						oController.getView().getElementBinding().refresh();

						var sText = oController.getResourceBundle().getText("successText1", [oResult.MaterialDocuments.results.length, oResult.PoNumber]);
						for (var i = 0; i < oResult.MaterialDocuments.results.length; i++) {
							sText += "<li>" + oResult.MaterialDocuments.results[i].MatDoc;
						}
						sText += oController.getResourceBundle().getText("successText2");

						var oRating = oController.getModel("common").createEntry("/FeedbackRatings").getObject();
						oRating.Rating = 0;
						oRating.Comments = "";
						oRating.SourceApp = "GR";
						oRating.SourceKey = oResult.MaterialDocuments.results[0].MatDoc;
						delete oRating.__metadata;
						var oRateModel = new JSONModel(oRating);
						var dialog = new sap.m.Dialog({
							title: oController.getResourceBundle().getText("successTitle"),
							type: "Message",
							state: "Success",
							busyIndicatorDelay: 0,
							content: [
								new sap.m.VBox({items: [
									new FormattedText({ htmlText: sText }),
									new sap.m.Label({ text: ""}),
									new FormattedText({ visible: oViewModel.getProperty("/isVim"), htmlText: oController.getResourceBundle().getText("vimSuccess") }),
									new sap.m.Label({visible: oViewModel.getProperty("/isVim"), text: ""}),
									new sap.m.Label({ text: oController.getResourceBundle().getText("ratingLabel")}),
									new sap.m.RatingIndicator({maxValue: 5, value:"{/Rating}", visualMode: sap.m.RatingIndicatorVisualMode.Full}),
									new sap.m.Label({ text: oController.getResourceBundle().getText("feedbackLabel")}),
									new sap.m.TextArea({value:"{/Comments}", width:"100%", placeholder:"Add " + oController.getResourceBundle().getText("feedbackLabel"), rows:3})
									]})
								],
								beginButton: new sap.m.Button({
									text: "Ok",
									type: sap.m.ButtonType.Emphasized,
									press: function (oEvent1) {
										var ratingPromise = jQuery.Deferred();
										oRating = oEvent1.getSource().getModel().getData();
										dialog.setBusy(true);

										if(!oRating.Rating && !oRating.Comments){
											ratingPromise.resolve();
										}
										else{
											oRating.Rating += "";
											oController.getModel("common").create("/FeedbackRatings", oRating, {
												success: function(){
													ratingPromise.resolve();
												},
												error: function(){
													ratingPromise.resolve();
												}
											});
											setTimeout(function(){ ratingPromise.resolve(); }, 700);
										}

										ratingPromise.then(function(){
											dialog.setBusy(false);
											dialog.close();
											if (oViewModel.getProperty("/isVim") === true) {
												var vimDoc = oController.getView().getBindingContext().getObject().Vimdocid;
												var sUrl = oController.getResourceBundle().getText("vimAppUrl", [vimDoc]);
												sap.m.URLHelper.redirect(sUrl, false);
											}
											else{
												oController.getRouter().navTo("po0", {}, false);
											}
										});

									}
								}),
								afterClose: function() {
									dialog.destroy();
								}
						});
						dialog.addStyleClass("sapUiSizeCompact");
						dialog.setModel(oRateModel);
						dialog.open();
						// var oFormattedText = new FormattedText("", { htmlText: sText });

						// MessageBox.success(oFormattedText, {
						//  title: oController.getResourceBundle().getText("successTitle"),
						//  initialFocus: null,
						//  onClose: function(sAction) {
						//    if (oViewModel.getProperty("/isVim") === true) {
						//      var vimDoc = oController.getView().getBindingContext().getObject().Vimdocid;
						//      var sUrl = oController.getResourceBundle().getText("vimAppUrl", [vimDoc]);
						//      sap.m.URLHelper.redirect(sUrl, false);
						//    }
						//    else{
						//      oController.getRouter().navTo("po0", {}, false);
						//    }
						//  }
						// });
					}
				},
				error: function (oError) {
					oViewModel.setProperty("/busy", false);
				}
			});
		},

		/**
		 *
		 */
		onAddMovtLine: function (oEvent) {
			var isVim = this.getModel("viewModel").getProperty("/isVim");
			var oDoc = this.getView().getBindingContext().getObject();
			this.getModel("movtModel").getProperty("/").push({
				MovtId: this.getModel("viewModel").getProperty("/maxMovtLineId") + 1,
				PoItem: "",
				PoItemVs: ValueState.None,
				RefDocNo: isVim ? oDoc.Invnumber : "",
						HeaderTxt: isVim ? oDoc.Vimdocid : "",
								DocDate: null,
								IsAsset: false,
								EntryQnt: "",
								EntryQntVs: ValueState.None,
								EntryUom: "",
								DocDateVs: ValueState.None,
								LineStatus: MessageType.None
			});
			this.refreshMovts();
		},

		/*
		 *
		 */
		onCopyMovtLine: function(oEvent) {
			var oButton = oEvent.getSource();
			var oBindingContext = oButton.getBindingContext("movtModel");
			var sPath = oBindingContext.getPath();
			var iIndex = sPath.substr(1);
			var oItem = this.getModel("movtModel").getProperty("/")[iIndex];
			var oNewItem = jQuery.extend(true, {}, oItem);
			oNewItem.MovtId = this.getModel("viewModel").getProperty("/maxMovtLineId") + 1;
			oNewItem.PoItem = "";
			oNewItem.EntryQnt = "";
			oNewItem.IsAsset = false;
			this.getModel("movtModel").getProperty("/").push(oNewItem);
			this.refreshMovts();
		},

		/*
		 *
		 */
		onDeleteMovtLine: function(oEvent) {
			var oButton = oEvent.getSource();
			var oBindingContext = oButton.getBindingContext("movtModel");
			var sPath = oBindingContext.getPath();
			var iIndex = sPath.substr(1);
			this.getModel("movtModel").getProperty("/").splice(iIndex, 1);
			this.refreshMovts();
		},

		/**
		 *
		 */
		refreshMovts: function() {

			var oViewModel = this.getModel("viewModel");

			var aItems = this.getModel("itemModel").getProperty("/");

			this.getModel("movtModel").refresh();
			var aMovts = this.getModel("movtModel").getProperty("/");

			var iMaxId = 0;
			var iMovtTotal = 0;
			var iMovtTotalIncTax = 0;

			for (var i = 0; i < aMovts.length; i++) {
				if (aMovts[i].MovtId > iMaxId) {
					iMaxId = aMovts[i].MovtId;
				}
				var iLineTotal = 0;
				var iLineTax = 0;
				for (var j = 0; j < aItems.length; j++) {
					if (aItems[j].PoItem === aMovts[i].PoItem) {
						iLineTotal = Number(aItems[j].NetPrice) * Number(aMovts[i].EntryQnt);
						iLineTax = iLineTotal * Number(aItems[j].TaxRate);

						aMovts[i].IsAsset = aItems[j].IsAsset;

						break;
					}
				}
				iMovtTotal += iLineTotal;
				iMovtTotalIncTax += iLineTotal + iLineTax;

			}

			oViewModel.setProperty("/maxMovtLineId", iMaxId);
			oViewModel.setProperty("/movtLineCount", aMovts.length);
			oViewModel.setProperty("/movtTotal", iMovtTotal);
			oViewModel.setProperty("/movtTotalIncTax", iMovtTotalIncTax);
			oViewModel.setProperty("/hasChanges", true);					
		},

		/**
		 *
		 */
		selectMovtPoItem: function (oEvent) {
			this.refreshMovts();

			var oSource = oEvent.getSource();

			// selected item
			var sSelectedItem = oSource.getSelectedItem().getKey();

			var aItems = this.getModel("itemModel").getProperty("/");

			this.getModel("movtModel").refresh();
			var aMovts = this.getModel("movtModel").getProperty("/");

			for (var i = 0; i < aMovts.length; i++) {
				for (var j = 0; j < aItems.length; j++) {
					if (sSelectedItem === aMovts[i].PoItem === aItems[j].PoItem) {
						aMovts[i].IsAsset = aItems[j].IsAsset;
					}
				}
			}

		},

		/*
		 *
		 */
		onLiveChangeQty: function (oEvent) {
			var oVal = oEvent.getParameter("value");
			var oPrevVal = oEvent.getParameter("previousValue");

			if (! this.isNumber(oVal)) {
				var fTotal = parseFloat(oVal);
				if (isNaN(fTotal)) {
					fTotal = parseFloat(oPrevVal);
					if (isNaN(fTotal)) {
						fTotal = "";
					}
				}
				oEvent.getSource().setValue(fTotal);
			}
		},

		/**
		 *
		 */
		_addError: function(sMessage, sTarget) {
			var bAlreadyIn = false;
			var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().oData;
			aMessages.forEach(function (oMessage) {
				if (oMessage.message === sMessage) {
					bAlreadyIn = true;
				}
			});

			if (! bAlreadyIn) {
				sap.ui.getCore().getMessageManager().addMessages(new Message({
					message: sMessage,
					type: MessageType.Error
				}));
			}

			this.getModel("movtModel").setProperty(sTarget, ValueState.Error);
		},

		/* =========================================================== */
		/* PO Asset Details                                            */
		/* =========================================================== */

		/**
		 * open asset detail
		 */
		onAssetDetail: function(oEvent) {
			var oViewModel = this.getModel("viewModel");

			var oSource = oEvent.getSource();
			var oBindingContext = oSource.getBindingContext("movtModel");
			var sPath = oBindingContext.getPath();
			var iIndex = sPath.substr(1);
			var oItem = this.getModel("movtModel").getProperty("/")[iIndex];

			var sAssets = this.getModel("assetModel").getJSON();
			var sAssetsFiltered = this.filterByProperty(JSON.parse(sAssets), {PoItem: oItem.PoItem});
			var oAssetModelFiltered = new JSONModel(sAssetsFiltered);
			var oAsset = oAssetModelFiltered.oData[0];

			var oModel = this.getOwnerComponent().getModel();
			var sObjectPath = oModel.createKey("/Assets", {
				CompCode: oViewModel.getProperty("/poCompCode"),
				AssetNo: oAsset.AssetNo,
				SubNumber: oAsset.SubNumber
			});

			this.getAssetDetailDialog().bindElement({
				path: sObjectPath,
				events: {
					change: function (oEvent) {
					},
					dataRequested: function (oEvent) {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function (oEvent) {
						oViewModel.setProperty("/busy", false);
					}
				}
			});

			this.getAssetDetailDialog().open();
		},

		/*
		 *
		 */
		filterByProperty: function(my_object, my_criteria){
			return my_object.filter(function(obj) {
				return Object.keys(my_criteria).every(function(c) {
					return obj[c] == my_criteria[c];
				});
			});
		},

		/**
		 * update and coles asset detail
		 */
		onAssetDetailUpdate: function() {
			var oViewModel = this.getModel("viewModel");
			oViewModel.setProperty("/busy", true);

			// data to be submitted
			var oBindingContext = this.getAssetDetailDialog().getBindingContext();
			var oData = this.getModel().getObject(oBindingContext.getPath());


			var oModel = this.getOwnerComponent().getModel();
			oModel.create("/Assets", oData, {
				success: function (oResult, oResponse) {
					oViewModel.setProperty("/busy", false);

					var aMessages = this.getModel("message").oData;

					var aMessage = aMessages[0];

					if (aMessage.type === "Success") {
						this.getAssetDetailDialog().close();
						sap.m.MessageToast.show(aMessage.message, {
							my: sap.ui.core.Popup.Dock.CenterCenter,
							at: sap.ui.core.Popup.Dock.CenterCenter,
							width: "20em"
						});
						/*MessageBox.success(aMessage.message, {
              title: this.getResourceBundle().getText("successTitle"),
              initialFocus: null,
              onClose: function(sAction) {
                this.getAssetDetailDialog().close();
              }.bind(this)
            });
						 */
					} else {
						this.getAssetDetailDialog().close();
						MessageBox.errorr(aMessage.message, {
							title: this.getResourceBundle().getText("errorTitle"),
							initialFocus: null
						});
					}
				}.bind(this),
				error: function (oError) {
					oViewModel.setProperty("/busy", false);
				}
			});

		},

		/**
		 * close asset detail
		 */
		onAssetDetailCancel: function() {
			this.getAssetDetailDialog().close();
		},

		/**
		 * Returns the asset details dialog (creates if necessary)
		 */
		getAssetDetailDialog: function () {
			if (! this.oAssetDetails) {
				this.oAssetDetails = sap.ui.xmlfragment("au.gov.defence.roman.zfss.gr.view.POAssetDetail", this);
				this.oAssetDetails.setEscapeHandler(function(oEscHandler) {oEscHandler.reject(); });
				syncStyleClass("sapUiSizeCompact", this.getView(), this.oAssetDetails);
				this.getView().addDependent(this.oAssetDetails);
			}
			return this.oAssetDetails;
		},

		/* =========================================================== */
		/* PO Select Dialog                                            */
		/* =========================================================== */

		/**
		 * show PO select dialog
		 */
		onPoSelectOK: function() {
			var sPoNumber = this.getModel("viewModel").getProperty("/poSelectInput");
			var oController = this;
			if (sPoNumber === "") {
				MessageBox.error(oController.getResourceBundle().getText("poBlankErrorText"), {
					title: oController.getResourceBundle().getText("errorTitle"),
					initialFocus: null,
					onClose: function(sAction) {
					}
				});
			} else {
				this.getRouter().navTo("po1", {
					objectId: sPoNumber
				}, false);

				this.getPOSelectDialog().close();
			}
		},

		/**
		 * close PO select dialog
		 */
		onPoSelectCancel: function() {
			this.onNavHome();
		},

		/**
		 * Return PO select dialog (creates if necessary)
		 */
		getPOSelectDialog: function () {
			if (! this.oPOSelectDialog) {
				this.oPOSelectDialog = sap.ui.xmlfragment("au.gov.defence.roman.zfss.gr.view.POSelectDialog", this);
				this.oPOSelectDialog.setEscapeHandler(function(oEscHandler) {oEscHandler.reject(); });
				syncStyleClass("sapUiSizeCompact", this.getView(), this.oPOSelectDialog);
				this.getView().addDependent(this.oPOSelectDialog);
			}
			return this.oPOSelectDialog;
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Override _onNavHome to include confirmation
		 */
		_onNavHome: function(oEvent) {
		    var oController = this;
		    var oViewModel = this.getModel("viewModel");
		    
		    // Check if there's unsaved data
		    var bHasUnsavedChanges = oViewModel.getProperty("/hasChanges");
		    
		    if (bHasUnsavedChanges) {
		        MessageBox.warning(this.getResourceBundle().getText("confirmExit"), {
		            initialFocus: null,
		            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
		            onClose: function(sAction) {
		                if (sAction === MessageBox.Action.OK) {
		                    oController._resetView();
		                    oController.onNavHome();
		                }
		            }
		        });
		    } else {
		        oController.onNavHome();
		    }
		},

		/**
		 * Override _onNavBack to handle both FLP and internal navigation
		 */
		_onNavBack: function (oEvent) {
		    var oController = this;
		    var oViewModel = this.getModel("viewModel");
		    
		    // Check if there's unsaved data
		    var bHasUnsavedChanges = oViewModel.getProperty("/hasChanges");
		    
		    if (bHasUnsavedChanges) {
		        MessageBox.warning(this.getResourceBundle().getText("confirmExit"), {
		            initialFocus: null,
		            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
		            onClose: function(sAction) {
		                if (sAction === MessageBox.Action.OK) {
		                    oController._resetView();
		                    
		                    // Check if we're in FLP - go home, otherwise go to PO dialog
		                    if (oController.getModel("componentModel").getProperty("/inFLP")) {
		                        oController.onNavHome();
		                    } else {
		                        if (oViewModel.getProperty("/isVim") === true) {
		                            history.go(-1);
		                        } else {
		                            oController._onNoPO(oEvent);
		                        }
		                    }
		                }
		            }
		        });
		    } else {
		        // No unsaved changes, navigate immediately
		        if (oController.getModel("componentModel").getProperty("/inFLP")) {
		            oController.onNavHome();
		        } else {
		            if (oViewModel.getProperty("/isVim") === true) {
		                history.go(-1);
		            } else {
		                oController._onNoPO(oEvent);
		            }
		        }
		    }
		},
		
		/**
		 * Track changes when fields are modified
		 */
		_onFieldChange: function() {
		    this.getModel("viewModel").setProperty("/hasChanges", true);
		},

		/**
		 * Modified _onNoPO
		 */
		_onNoPO: function (oEvent) {
		    this._resetView();
		    
		    this.getModel().metadataLoaded().then( function() {
		        this.getPOSelectDialog().open();
		    }.bind(this));
		},

		/**
		 *
		 */
		_onPOMatched: function (oEvent) {
			this._resetView();

			var sObjectId =  oEvent.getParameter("arguments").objectId;
			this.getModel().metadataLoaded().then(function () {
				this._bindView(sObjectId);
			}.bind(this));
		},

		/**
		 *
		 */
		_onVIMMatched: function (oEvent) {
			this._resetView();
			this.getModel("viewModel").setProperty("/isVim", true);

			var sObjectId =  oEvent.getParameter("arguments").objectId;
			this.getModel().metadataLoaded().then(function () {
				this._bindViewVim(sObjectId);
			}.bind(this));
		},

		/* =========================================================== */
		/* value help methods                                          */
		/* =========================================================== */

		/**
		 *
		 */
		onPOValueHelpRequested: function(oEvent) {

			var oViewModel = this.getModel("viewModel");
			oViewModel.setProperty("/busy", true);

			var oResourceBundle = this.getResourceBundle();

			var oDType = new sap.ui.model.type.Date({pattern: "dd.MM.yyyy"});

			//
			var oColModel = new JSONModel();
			oColModel.setData({
				cols: [
					{
						"label": oResourceBundle.getText("vhPO"),
						"template": "PoNumber"
					},
					{
						"label": oResourceBundle.getText("vhOA"),
						"template": "OaNumber",
					},
					{
						"label": oResourceBundle.getText("vhVendor"),
						"template": "Vendor"
					},
					{
						"label": oResourceBundle.getText("vhVendorName"),
						"template": "VendorName",
						"width": "19rem"
					},
					{
						"label": oResourceBundle.getText("vhABN"),
						"template": "Abn"
					},
					{
						"label": oResourceBundle.getText("vhCreateDate"),
						"template": "CreatDate",
						"oType": oDType
					}
					]
			});

			if (! this.oValueHelpDialog ) {
				this.oValueHelpDialog = sap.ui.xmlfragment("au.gov.defence.roman.zfss.gr.view.POValueHelp", this);
				syncStyleClass("sapUiSizeCompact", this.getView(), this.oValueHelpDialog);
				this.getView().addDependent(this.oValueHelpDialog);
				var oController = this;
				this.oValueHelpDialog.attachBrowserEvent("keydown", function (oEvent) {
					//add an event handler for searching by ENTER key
					if (oEvent.keyCode === KeyCodes.ENTER) {
						oEvent.stopImmediatePropagation();
						oEvent.preventDefault();
						oController.oValueHelpDialog.getFilterBar().search();
					}
				});

				this.oValueHelpDialog.getTableAsync().then(function (oTable) {
					oTable.setModel(this.getOwnerComponent().getModel());
					oTable.setModel(oColModel, "columns");
					if (oTable.bindRows) {
						oTable.bindRows("/PurchaseOrderLookups");
					}
					oTable.setBusyIndicatorDelay(1);
					oTable.setEnableBusyIndicator(true);
					this.oValueHelpDialog.update();
				}.bind(this));

				this.oValueHelpDialog._sTableTitleNoCount = oResourceBundle.getText("vhTableTitle");

				var oFilterBar = this.oValueHelpDialog.getFilterBar();
				//Hide 'Hide Advanced Search' button
				//oFilterBar._oHideShowButton = new sap.m.Button();
				oFilterBar._oHideShowButton.setVisible(false);
			}


			this.oValueHelpDialog.getTable().setNoData(oResourceBundle.getText("vhNoData1"));

			this.oValueHelpDialog.setTokens([]);
			this.oValueHelpDialog.open();

			oViewModel.setProperty("/busy", false);
		},

		/**
		 *
		 */
		onPoValueHelpOkPress: function(oEvent) {
			var oToken = oEvent.getParameter("tokens")[0];
			this.getModel("viewModel").setProperty("/poSelectInput", oToken.getKey());
			this.oValueHelpDialog.close();

		},

		/**
		 *
		 */
		onPoValueHelpCancelPress: function(oEvent) {
			this.oValueHelpDialog.close();
		},

		/**
		 *
		 */
		onPoValueHelpAfterClose: function(oEvent) {

		},

		/**
		 *
		 */
		getDateValue: function(sDate) {
			return new Date(sDate.substr(6,4),(sDate.substr(3,2)-1),sDate.substr(0,2));
		},

		/**
		 *
		 */
		onPoFilterBarSearch: function(oEvent) {


			var oController = this;
			var aSelectionSet = oEvent.getParameter("selectionSet");
			var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
				if (oControl.getValue()) {
					if (oControl.getName() === "CreatDate") {
						var sDate = oControl.getValue();
						var sDate1 = oController.getDateValue(sDate.substring(0,10));
						var sDate2 = oController.getDateValue(sDate.substring(sDate.length - 10));

						aResult.push(new Filter({
							path: 'CreatDate',
							operator: FilterOperator.BT,
							value1: sDate1,
							value2: sDate2
						}));
					} else {
						aResult.push(new Filter({
							path: oControl.getName(),
							operator: FilterOperator.Contains,
							value1: oControl.getValue()
						}));
					}
				}

				return aResult;
			}, []);

			var oFilter = new Filter({
				filters: aFilters,
				and: true
			});

			var oBinding = this.oValueHelpDialog.getTable().getBinding("rows");

			this.oValueHelpDialog.getTable().setNoData(this.getResourceBundle().getText("vhNoData2"));

			if (aFilters.length > 0) {
				oBinding.filter(oFilter);
			} else {
				MessageBox.error(this.getResourceBundle().getText("vhNoParameter"));
			}
		},

		/**
		 *
		 */
		_resetView: function() {
			this.getView().unbindElement();

			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				poSelectInput: "",
				bound: false,
				movtLineCount: 0,
				maxMovtLineId: 0,
				movtTotal: 0,
				movtTotalIncTax: 0,
				itemsCount: 0,
				posted: false,
				itemsScrollHeight: "",
				messageButtonType: "Ghost",
				messageButtonIcon: "sap-icon://warning2",
				poCurrency: "",
				poCompCode: "",
				hasChanges: false,
				isVim: false,
				isMfp: false
			});
			this.setModel(oViewModel, "viewModel");		    
		},

		/**
		 *
		 */
		_bindView: function (sObjectId) {
			var sPoNumber = sObjectId;
			if (sPoNumber.length >= 10) sPoNumber = sPoNumber.substring(0,10);

			var oModel = this.getOwnerComponent().getModel();
			var sObjectPath = oModel.createKey("/PurchaseOrders", {
				PoNumber: sPoNumber
			});

			this._bindElement(sObjectPath);

			if (history.length < 2) {
				this.getModel("viewModel").setProperty("/isMfp", true);
			}
		},

		/**
		 *
		 */
		_bindViewVim: function (sObjectId) {
			var oModel = this.getOwnerComponent().getModel();
			var sObjectPath = oModel.createKey("/PurchaseOrders", {
				PoNumber: sObjectId
			});

			this._bindElement(sObjectPath);
		},

		/**
		 *
		 */
		_bindElement: function (sObjectPath) {
			var oViewModel = this.getModel("viewModel");
			oViewModel.setProperty("/busy", true);

			var bDataRequested = false;

			var oController = this;

			this.getView().bindElement({
				path: sObjectPath,
				parameters: {
					expand: "Items,Movements,MaterialDocuments,Assets"
				},
				events: {
					change: function (oEvent) {
						oViewModel.setProperty("/busy", false);

						if (! bDataRequested) {
							var oContextBinding = oEvent.getSource();
							oContextBinding.refresh(false);
						}
					},
					dataRequested: function (oEvent) {
						oViewModel.setProperty("/bound", false);
						bDataRequested = true;
					},
					dataReceived: function (oEvent) {
						oViewModel.setProperty("/busy", false);

						var oPO = oEvent.getParameters("data").data;
						if (!oPO || oPO.PoNumber === "") {
							MessageBox.error(oController.getResourceBundle().getText("poNotFoundErrorText"), {
								title: oController.getResourceBundle().getText("errorTitle"),
								initialFocus: null,
								onClose: function(sAction) {
									oController._onNoPO();
								}
							});
						} else if (oPO.Excluded) {
							MessageBox.error(oController.getResourceBundle().getText("poExcluded"), {
								title: oController.getResourceBundle().getText("errorTitle"),
								initialFocus: null,
								onClose: function(sAction) {
									oController._onNoPO();
								}
							});
						} else if (!oPO.Complete) {
							MessageBox.error(oController.getResourceBundle().getText("poNotComplete"), {
								title: oController.getResourceBundle().getText("errorTitle"),
								initialFocus: null,
								onClose: function(sAction) {
									oController._onNoPO();
								}
							});
						} else if (!oPO.Approved) {
							MessageBox.error(new FormattedText("", {htmlText: oController.getResourceBundle().getText("poNotApproved")}), {
								title: oController.getResourceBundle().getText("errorTitle"),
								initialFocus: null,
								onClose: function(sAction) {
									oController._onNoPO();
								}
							});
						} else if (oPO.Items.length === 0 && !oViewModel.getProperty("/posted")) {
							MessageBox.error(oController.getResourceBundle().getText("poNotValidForGRErrorText"), {
								title: oController.getResourceBundle().getText("errorTitle"),
								initialFocus: null,
								onClose: function(sAction) {
									oController._onNoPO();
								}
							});
						} else {
							var oItemModel = new JSONModel();
							if (oPO.Items.length > 100) {
								oItemModel.setSizeLimit(oPO.Items.length);
							}
							oItemModel.setData(oPO.Items);
							oController.setModel(oItemModel, "itemModel");

							var oMovtModel = new JSONModel();
							oMovtModel.setData(oPO.Movements);
							oController.setModel(oMovtModel, "movtModel");

							var oAssetModel = new JSONModel();
							oAssetModel.setData(oPO.Assets);
							oController.setModel(oAssetModel, "assetModel");

							oViewModel.setProperty("/maxMovtLineId", 0);
							oController.onAddMovtLine();

							oViewModel.setProperty("/itemsCount", oPO.Items.length);
							oViewModel.setProperty("/itemsScrollHeight", oPO.Items.length > 10 ? "20em" : "");
							oViewModel.setProperty("/poCurrency", oPO.Currency);
							oViewModel.setProperty("/poCompCode", oPO.CompCode);
							oViewModel.setProperty("/bound", true);

							sap.ui.getCore().getMessageManager().removeAllMessages();
						}
					}
				}
			});

		}

	});

});