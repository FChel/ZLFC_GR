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

  return BaseController.extend("au.gov.defence.roman.zfss.gr.controller.GR", {

    formatter: formatter,

    /* =========================================================== */
    /* lifecycle methods                                           */
    /* =========================================================== */

    /**
     * init
     */
    onInit: function () {
      // matched GR display route
      this.getRouter().getRoute("gr1").attachPatternMatched(this._onGRDisplayMatched, this);

      // matched GR selection route
      this.getRouter().getRoute("gr0").attachPatternMatched(this._onGRSelectForDisplayMatched, this);

      // matched GR edit route
      this.getRouter().getRoute("grx1").attachPatternMatched(this._onGREditMatched, this);

      // matched GR edit route
      this.getRouter().getRoute("grx0").attachPatternMatched(this._onGRSelectForEditMatched, this);

      this.registerMessageManager();
    },

    /* =========================================================== */
    /* event handlers                                              */
    /* =========================================================== */

    /**
     *
     */
    onSubmitConfirm: function() {
      var oController = this;
      MessageBox.warning(this.getResourceBundle().getText("grCancelConfirmText"), {
        title: this.getResourceBundle().getText("grCancelConfirmTitle"),
        initialFocus: null,
        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
        onClose: function(sAction) {
          if (sAction === MessageBox.Action.OK) {
            oController.onSubmit();
          }
        }
      });
    },

    /**
     * submit clicked: validate and submit data to the backend
     */
    onSubmit: function () {
      var oViewModel = this.getModel("viewModel");

      // reset all errors
      sap.ui.getCore().getMessageManager().removeAllMessages();
      var bError = false;

      // data to be submitted
      var oBindingContext = this.getView().getBindingContext();
      var oData = this.getModel().getObject(oBindingContext.getPath(), {expand: 'Items,MaterialDocuments'});
        var oItemData = this.getModel("itemModel").oData;
        oData.Items = oItemData;

      var sText = "";
      var sTitle = "";
      var oController = this;
      oViewModel.setProperty("/busy", true);

      var oModel = this.getOwnerComponent().getModel();
      oModel.create("/GoodsReceipts", oData, {
        success: function (oResult, oResponse) {
          oViewModel.setProperty("/busy", false);

          var aMessage = oController.getModel("message").oData;
          for (var i = 0; i < aMessage.length; i++) {
            if (aMessage[i].type === "Error") {
              bError = true;
              break;
            }
          }

                  var oItemModel = new JSONModel();
                  oItemModel.setData(oResult.Items.results);
                  oController.setModel(oItemModel, "itemModel");

          if (bError) {
            var oButton = oController.byId("messagesButton");
                  oButton.firePress(oButton);

          } else {

            sTitle = oController.getResourceBundle().getText("successTitle");
            sText = oController.getResourceBundle().getText("grCancelSuccessText1", [oResult.MatDoc, oResult.PoNumber]);

            for (var i = 0; i < oResult.MaterialDocuments.results.length; i++) {
              sText += "<br>" + oController.getResourceBundle().getText("grCancelSuccessText2", [oResult.MaterialDocuments.results[i].MatDoc]);
            }

            // var oFormattedText = new FormattedText("", { htmlText: sText });

            var oRating = oController.getModel("common").createEntry("/FeedbackRatings").getObject();
            oRating.Rating = 0;
            oRating.Comments = "";
            oRating.SourceApp = "GR";
            oRating.SourceKey = oResult.MaterialDocuments.results[0].MatDoc;
            delete oRating.__metadata;
            var oRateModel = new JSONModel(oRating);
            var dialog = new sap.m.Dialog({
              title:"Success",
              type:"Message",
              state:"Success",
              busyIndicatorDelay:0,
              content: [
                new sap.m.VBox({items: [
                  new FormattedText("", { htmlText: sText }),
                  new sap.m.Label({ text: ""}),
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
                    oController.onNavHome();
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

            // MessageBox.success(oFormattedText, {
            //  title: sTitle,
            //  initialFocus: null,
            //  onClose: function(sAction) {
            //    oController.onNavHome();
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
    onPosting: function(oData) {

    },

    /**
     * cancel clicked
     */
    onCancel: function () {
      this.getRouter().navTo("grx1", {
        objectId: this.getModel("viewModel").getProperty("/objectId")
      }, false);
    },

    /**
     *
     */
    onMorePress: function (oEvent) {
        if (!this._actionSheet) {
          this._actionSheet = sap.ui.xmlfragment(this.getView().getId(), "au.gov.defence.roman.zfss.gr.view.GRMoreActionSheet", this);
          this.getView().addDependent(this._actionSheet);
        }
        if (this._actionSheet.isOpen()) {
          this._actionSheet.close();
        } else {
          this._actionSheet.openBy(oEvent.getSource());
        }
    },

    /* =========================================================== */
    /* GR Select dialog & event handlers                          */
    /* =========================================================== */

    /**
     * dialog OK clicked
     */
    onGRSelectOK: function() {
      var oViewModel = this.getModel("viewModel");
      var sGrNumber = oViewModel.getProperty("/grSelectInput");

      if (sGrNumber === "") {
        MessageBox.error(this.getResourceBundle().getText("grBlankErrorText"));
      } else {
        var sPath = "";
        if (oViewModel.getProperty("/editMode")) {
          sPath = "grx1";
        } else {
          sPath = "gr1";
        }

        this.getRouter().navTo(sPath, {
          objectId: sGrNumber
        }, false);

        this.getGRSelectDialog().close();
      }

    },

    /**
     * dialog Cancel clicked
     */
    onGRSelectCancel: function() {
      this.onNavHome();
    },

    /**
     * returns the dialog (creates if necessary)
     */
    getGRSelectDialog: function () {

      if (! this.oGRSelectDialog) {
        this.oGRSelectDialog = sap.ui.xmlfragment("au.gov.defence.roman.zfss.gr.view.GRSelectDialog", this);
        this.oGRSelectDialog.setEscapeHandler(function(oEscHandler) {oEscHandler.reject(); });
        syncStyleClass("sapUiSizeCompact", this.getView(), this.oGRSelectDialog);
        this.getView().addDependent(this.oGRSelectDialog);
      }

      return this.oGRSelectDialog;
    },


    /* =========================================================== */
    /* value help methods                                          */
    /* =========================================================== */

    /**
     *
     */
    onGRValueHelpRequested: function(oEvent) {

      var oViewModel = this.getModel("viewModel");
      oViewModel.setProperty("/busy", true);

      var oResourceBundle = this.getResourceBundle();

      var oDType = new sap.ui.model.type.Date({pattern: "dd.MM.yyyy"});

      var oNType = new sap.ui.model.type.Float();

      //
      var oColModel = new JSONModel();
      oColModel.setData({
        cols: [
          {
            "label": oResourceBundle.getText("vhGR"),
            "template": "MatDoc"
          },
          {
            "label": oResourceBundle.getText("vhPO"),
            "template": "PoNumber",
          },
          {
            "label": oResourceBundle.getText("vhVendorName"),
            "template": "VendorName"
          },
          {
            "label": oResourceBundle.getText("vhHeaderTxt"),
            "template": "HeaderTxt"
          },
          {
            "label": oResourceBundle.getText("vhRefDocNo"),
            "template": "RefDocNo"
          },
          {
            "label": oResourceBundle.getText("vhDocDate"),
            "template": "DocDate",
            "oType": oDType
          },
          {
            "label": oResourceBundle.getText("vhQty"),
            "template": "EntryQnt",
            "oType": oNType
          }
        ]
      });

      if (! this.oValueHelpDialog ) {
        this.oValueHelpDialog = sap.ui.xmlfragment("au.gov.defence.roman.zfss.gr.view.GRValueHelp", this);
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
            oTable.bindRows("/GoodsReciptLookups");
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
    onGRValueHelpOkPress: function(oEvent) {
      var oToken = oEvent.getParameter("tokens")[0];
      this.getModel("viewModel").setProperty("/grSelectInput", oToken.getKey());
      this.oValueHelpDialog.close();

    },

    /**
     *
     */
    onGRValueHelpCancelPress: function(oEvent) {
      this.oValueHelpDialog.close();
    },

    /**
     *
     */
    onGRValueHelpAfterClose: function(oEvent) {
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
    onGRFilterBarSearch: function(oEvent) {

      var oController = this;
      var aSelectionSet = oEvent.getParameter("selectionSet");
      var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
        if (oControl.getValue()) {
          if (oControl.getName() === "DocDate") {
            var sDate = oControl.getValue();
            var sDate1 = oController.getDateValue(sDate.substring(0,10));
            var sDate2 = oController.getDateValue(sDate.substring(sDate.length - 10));

            aResult.push(new Filter({
              path: 'DocDate',
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

    /* =========================================================== */
    /* internal methods                                            */
    /* =========================================================== */

    onNoGR: function (oEvent) {
      var sPath = "";
      if (this.getModel("viewModel").getProperty("/editMode")) {
        sPath = "grx0";
      } else {
        sPath = "gr0";
      }
      this.getRouter().navTo(sPath, {}, false);
    },

    /**
     *
     */
        _onGRSelectForDisplayMatched: function (oEvent) {
          this._resetView();
          this.getModel("viewModel").setProperty("/editMode", false);
      this.getModel().metadataLoaded().then(function() {
        this.getGRSelectDialog().open();
      }.bind(this));
    },

    /**
     *
     */
    _onGRDisplayMatched: function (oEvent) {
      this._resetView();
      this.getModel("viewModel").setProperty("/editMode", false);
      var sObjectId =  oEvent.getParameter("arguments").objectId;
      this.getModel().metadataLoaded().then(function () {
        this._bindView(sObjectId, false);
      }.bind(this));
    },

    /**
     *
     */
        _onGRSelectForEditMatched: function (oEvent) {
          this._resetView();
          this.getModel("viewModel").setProperty("/editMode", true);
      this.getModel().metadataLoaded().then(function() {
        this.getGRSelectDialog().open();
      }.bind(this));
    },

    /**
     *
     */
    _onGREditMatched: function (oEvent) {
      this._resetView();
      this.getModel("viewModel").setProperty("/editMode", true);
      var sObjectId =  oEvent.getParameter("arguments").objectId;
      this.getModel().metadataLoaded().then(function () {
        this._bindView(sObjectId, true);
      }.bind(this));
    },

    /**
     *
     */
    _bindView: function (sObjectId) {
      var sMatDoc = "";
      var sDocYear = "";
      if (sObjectId.length >= 14) {
        sMatDoc = sObjectId.substring(0,10);
        sDocYear = sObjectId.substring(10,14);
      } else if (sObjectId.length >= 10) {
        sMatDoc = sObjectId.substring(0,10);
      }

      var oModel = this.getOwnerComponent().getModel();
      var sObjectPath = oModel.createKey("/GoodsReceipts", {
        MatDoc: sMatDoc,
        DocYear: sDocYear
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
          expand: "Items,MaterialDocuments"
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

            var oGR = oEvent.getParameters("data").data;
            if (!oGR || oGR.MatDoc === "") {
              MessageBox.error(oController.getResourceBundle().getText("grNotFoundErrorText"), {
                title: oController.getResourceBundle().getText("errorTitle"),
                initialFocus: null,
                onClose: function(sAction) {
                  oController.onNoGR();
                }
              });
            } else if (oViewModel.getProperty("/editMode") === true && oGR.Items && oGR.Items[0] && Number(oGR.Items[0].EntryQnt) < 0) {

              MessageBox.error(oController.getResourceBundle().getText("grCancelCancellation"), {
                title: oController.getResourceBundle().getText("errorTitle"),
                initialFocus: null,
                onClose: function(sAction) {
                  oController.onNoGR();
                }
              });
            }
            else if (oGR.MatDoc === "_") {
              var sText = "";
              if (oViewModel.getProperty("/editMode")) {
                sText = oController.getResourceBundle().getText("grNotStandardPo");
              } else {
                sText = oController.getResourceBundle().getText("grNotStandardPoDisplay");
              }
              MessageBox.error(sText, {
                title: oController.getResourceBundle().getText("errorTitle"),
                initialFocus: null,
                onClose: function(sAction) {
                  oController.onNoGR();
                }
              });
            } else {
              var aItems = oGR.Items.filter(function(oItem) {
                return oItem.NoMoreGr !== true && oItem.Reversed !== true;
              });

              if (oViewModel.getProperty("/editMode")) {
                oGR.Items = oGR.Items.filter(function(oItem) {
                  return oItem.NoMoreGr !== true && oItem.Reversed !== true;
                });
              }

              if (oViewModel.getProperty("/editMode") && aItems.length === 0) {
                var sText = oController.getResourceBundle().getText("grNoLines");
                var oFormattedText = new FormattedText("", { htmlText: sText });
                MessageBox.error(oFormattedText, {
                  title: oController.getResourceBundle().getText("errorTitle"),
                  initialFocus: null,
                  onClose: function(sAction) {
                    oController.onNoGR();
                  }
                });
              } else {

                        var oItemModel = new JSONModel();
                        oItemModel.setData(oGR.Items);
                        oController.setModel(oItemModel, "itemModel");

                        oViewModel.setProperty("/canBeCancelled", aItems.length !== 0 && !oViewModel.getProperty("/editMode"));
                oViewModel.setProperty("/bound", true);
                oViewModel.setProperty("/objectId", oGR.MatDoc + oGR.DocYear);

                sap.ui.getCore().getMessageManager().removeAllMessages();
              }
            }
          }
        }
      });
    },

    /**
     *
     */
    _resetView: function () {
      this.getView().unbindElement();

            this.setModel(new JSONModel({}), "itemModel");

      // setup the view model
      var oViewModel = new JSONModel({
        busy: false,
        delay: 0,
        grSelectInput: "",
        objectId: "",
        bound: false,
        editMode: false,
        selected: true,
        canBeCancelled: true,
            messageButtonType: "Ghost",
            messageButtonIcon: "sap-icon://warning2"
      });
      this.setModel(oViewModel, "viewModel");
    },

    /**
     *
     */
    onItemSelectionChanged: function(oEvent) {
      var oBindingContext = this.getView().getBindingContext();
      var oData = this.getModel().getObject(oBindingContext.getPath(), {expand: 'Items'});
      var bSelected = false;
      for (var i = 0; i < oData.Items.length; i++) {
        if (oData.Items[i].Selected) {
          bSelected = true;
          break;
        }
      }
      this.getModel("viewModel").setProperty("/selected", bSelected);

    }

  });
});