// in memory globals
var words = {};
var lastdbid = 0;
var semdomdata = {};
var version = "1.0";
var appName = "semdomgatherwords";
/* local storage namespace */
var localStorageNamespace = appName + version + "_";
var localStorageItemIndex = {};
var firstPageView_AddWords = true;
var loadingSemdomXml = false;

// application preferences (persistent in local storage)
var prefs = {
    lfhost: "www.languageforge.com",
    lfprojectname: "",
    lfusername: "",
    lfpassword: "",

    showmeaning: true,
    word_ws: "de",
    meaning_ws: "en",
    uilanguage: "en",
    showdomains: {
        "1": true,
        "2": false,
        "3": false,
        "4": false,
        "5": false,
        "6": false,
        "7": false,
        "8": false,
        "9": false
    }
};

/* mode: "list", "gather", "edit", "listdeleteitem"
*  itemid: the itemid of the object in the datastore to edit.  For list and add view, this is undefined */
var state = {mode: "list", itemid: undefined};

// global error handler
window.onerror = onJavascriptError;


$(document).ready(function(){

    // Modernizr checks
    if (! Modernizr.localstorage) {
        alert("Local Storage is not supported!  All changes will be lost when browser or app is closed");
    }
    else {
        initializeLocalStorage();
    }
    
    // register event handlers
    $("#wordform_addbutton").bind('vclick', onItemViewAddWordButtonClick);
    $("#wordform_donebutton").bind('vclick', onItemViewDoneButtonClick);
    $("#wordform_semdomselect").change(onItemViewSemdomSelectChange);
    $("#wordform_slider").change(onItemViewSliderChange);
    $("#wordform_word").keyup(onAddEditWordKeyPress);
    $("#wordform_meaning").keyup(onAddEditWordKeyPress);

    $("#listwords_gatherbutton").bind('vclick', onListViewGatherWordsButtonClick);
    $("#listwords_editbutton").bind('vclick', onListViewEditButtonClick);
    $("#listwords_prefsbutton").bind('vclick', onListViewPrefsButtonClick);
    $("#listwords_semdomselect").change(onListViewSemdomSelectChange);
    $("#listwords_list").on("vclick", "a", onListViewItemClick);

    $("#prefs").on("vclick", "a.prefs-done", onPrefsViewDoneButtonClicked);
    $("#uploadbutton").bind('vclick', onPrefsViewUploadButtonClicked);

    loadingSemdomXml = true;
    $.getJSON("resources/ddp4.json", function(data) {
        semdomdata = data;
        loadSelectWithSemdomData($("#listwords_semdomselect"), true);
        loadSelectWithSemdomData($("#wordform_semdomselect"));
        $("#listwords_semdomselect").selectmenu().selectmenu('refresh');
        loadingSemdomXml = false;
	    updateView();
    });
});




// event handlers (usually button clicks)

function onListViewGatherWordsButtonClick() {
    state.mode = "gather";
    updateView();
}

function onItemViewAddWordButtonClick() {
    addWordToSummaryBox($("#wordform_word").val());
    addWordToStorage(
        $("#wordform_word").val(),
        $("#wordform_meaning").val(),
        $("#wordform_semdomselect").val()
    );
    resetAddWordForm();
    $("#wordform_word").focus();
    //onItemViewSemdomSelectChange();  // update the semdom description
}

function onItemViewDoneButtonClick() {
    if (state.mode === "edit") {
        // we are updating the word
        updateWordInStorage(
            $("#wordform_itemid").val(),
            $("#wordform_word").val(),
            $("#wordform_meaning").val(),
            $("#wordform_semdomselect").val()
        );
    }
    else {  // state.mode === "add"
        addWordToStorage(
            $("#wordform_word").val(),
            $("#wordform_meaning").val(),
            $("#wordform_semdomselect").val()
        );
        resetAddWordForm();
    }
    state.mode = "list";
    updateView();
}

function onListViewItemClick() {
    if (state.mode == "list") {
        state.mode = "edit";
        state.itemid = $(this).data('itemid');
        updateView();
    }
    else if (state.mode == "listdeleteitem") {
        $(this).fadeTo(300, .2).hide(300);
        removeWordFromStorage($(this).data('itemid'));
        decrementWordCount();
    }
    else {
        alert("unknown state '" + state.mode + "'");
    }
}

function onListViewEditButtonClick() {
    if (state.mode == "list") {
        state.mode = "listdeleteitem";

        // add delete icon
        $("#listwords li").each(function() {
            $(this).children('div.ui-btn-inner').children('span.ui-icon').removeClass('ui-icon-arrow-r').addClass('ui-icon-delete');
        });

        // change theme to yellow
        changeListViewElementTheme("#listwords li a", "e");

        //$("#listwords_list").listview("refresh");
        $("#listwords_editbutton").text("Done").button('refresh');
    }
    else { // mode == listdeleteitem
        state.mode = "list";

        $("#listwords li").each(function() {
            //$(this).jqmData('icon', 'delete');
            $(this).children('div.ui-btn-inner').children('span.ui-icon').removeClass('ui-icon-delete').addClass('ui-icon-arrow-r');
        });

        // change theme back to light grey
        changeListViewElementTheme("#listwords li a", "d");

        $("#listwords_editbutton").text("Edit List").button('refresh');
        updateView();  // this is necessary because the list seems to have visual "artifacts" from the delete operation
    }
}

function onItemViewSemdomSelectChange() {
    // change the description text that is displayed

    // adjust slider values to this domain
    var numOfQuestions = parseInt(getSemdomNumOfDescriptions($("#wordform_semdomselect").val()));

    if (numOfQuestions > 1) {
        $("#wordform_slider_container").show();
        $("#wordform_slider").val("0").attr("max", numOfQuestions - 1).slider('refresh');
    }
    else {
        $("#wordform_slider_container").hide();
    }

    // call slider change handler (to adjust semdom description text)
    onItemViewSliderChange();
}

function onListViewSemdomSelectChange() {
    // filter the list view by semantic domain
    if (!loadingSemdomXml) {
        doListView();
    }
}

function onItemViewSliderChange() {
    //alert('change!');
    // update the semdom description to reflect the value on the slider
    if (!loadingSemdomXml) {
        var sid = $("#wordform_semdomselect").val();
        var qid = $("#wordform_slider").val();
        $("#wordform_description").text(getSemdomDescription(sid, qid));
    }
}

function onListViewPrefsButtonClick() {
    state.mode = "prefs";
    updateView();
}

function onPrefsViewDoneButtonClicked() {
	prefs.word_ws = $("#word_ws").val().toString();
	prefs.meaning_ws = $("#meaning_ws").val().toString();
	prefs.showmeaning = $("#showmeaning").val() == "show";
	
	prefs.uilanguage = $("#uilanguage").val();
	
	prefs.lfhost = $("#lf_host").val();
	prefs.lfprojectname = $("#lf_project").val();
	prefs.lfusername = $("#lf_username").val();
	prefs.jfpassword = $("#lf_password").val();
	
	$("#prefs_domainselect input").each(function() {
		var id = $(this).attr('id').substring(7);
		if (this.checked) {
			prefs.showdomains[id] = true;
		}
		else {
			prefs.showdomains[id] = false;
		}
	});
	
	updatePrefsInStorage();
	
	loadSelectWithSemdomData($("#listwords_semdomselect"), true);
    loadSelectWithSemdomData($("#wordform_semdomselect"));
        
	state.mode = "list";
	updateView();
}

function onPrefsViewUploadButtonClicked() {
	$.mobile.changePage('#lfupload', {transition: 'pop', role: 'dialog'});   
	
}


function onJavascriptError(msg, url, line) {
	$.mobile.changePage('#jserror', {transition: 'pop', role: 'dialog'});   
	$("#jserror_msg").text(msg);
	$("#jserror_url").text(url);
	$("#jserror_line").text("<b>Line:</b> " + line);
	$("#jserror_emaildev").prop('href',"mailto: semdomapp@palaso.org?subject=" + encodeURIComponent("Gather Words Javascript Error") + 
		"&body=" + encodeURIComponent("Line " + line + " of " + url + "\n\n" + msg));
}

function onAddEditWordKeyPress(e) {
	if ((e.keyCode || e.which) == 13) { // Enter Key
		onItemViewAddWordButtonClick();
	}
}







// view functions

function updateView() {
    if (state.mode === "list" || state.mode === "listdeleteitem") {
        state.mode = "list";
        doListView();
    }
    else if (state.mode === "gather") {
        doAddEditView();
    }
    else if (state.mode === "edit") {
        doAddEditView(state.itemid);
    }
    else if (state.mode == "prefs") {
        doPrefsView();
    }
}

function doListView() {
    $.mobile.changePage($("#listwords"));
	$("#listwords_semdomselect").selectmenu('refresh');

    // load words into table
    var items = getWordsFromStorage($("#listwords_semdomselect").val());
    $("#listwords_list").empty();

    var numOfItems = 0;
    for (x in items) {
        numOfItems++;
        var html = "<li><a data-itemid='" + items[x].id + "' href='#'><h3>" + items[x].word + "</h3>";
        if (prefs.showmeaning) {
            html += "<p><strong>" + items[x].meaning + "</strong></p>";
        }
        html += "<p class='ui-li-aside'>" + getSemdomFullName(items[x].semdomid) + "</p>" + "</a></li>";
        $("#listwords_list").append(html);
    }
    //$("#listwords_list li a").preventDefault(); // prevent href in anchors from working
    $("#listwords_list li").tsort(); // tiny sort
    $("#listwords_list").listview("refresh");

    updateWordCount(numOfItems);
}

function doAddEditView(id) {
    var addWordButton = $("#wordform_addbutton").closest('.ui-btn');
    $("#wordform_slider_container .ui-slider-input").css("display", "none"); // hide the number on the slider
    
    // update the writing system labels
    $("#wordform_wordcontainer .writingsystemlabel").text("[" + prefs.word_ws + "]");
    $("#wordform_meaningcontainer .writingsystemlabel").text("[" + prefs.meaning_ws + "]");
    
    if (state.mode === "edit") {
        $.mobile.changePage($("#addeditword"), {transition: "slidefade"});

        // we are editing an existing word
        // load word into model
        var item = getWordFromStorage(id);

        $("#wordform_itemid").val(item.id);
        $("#wordform_word").val(item.word);
        $("#wordform_meaning").val(item.meaning);
        $("#wordform_semdomselect").parent().hide();
        addWordButton.hide();
        $("#wordform_description").html("<i>Gathered under</i> " + getSemdomFullName(item.semdomid));
        $("#wordform_slider_container").hide();
    }
    else {
        $.mobile.changePage($("#addeditword"), {transition: "flip"});
		$("#wordform_semdomselect").selectmenu('refresh');
        $("#wordform_slider_container").show();
        addWordButton.show();
        $("#wordform_semdomselect").parent().show();
        resetAddWordForm();
        onItemViewSemdomSelectChange();  // update the semdom description
    }


    // a hack because I couldn't get this to work in the initial loader
    if (firstPageView_AddWords) {
        firstPageView_AddWords = false;
        $("#wordform_semdomselect").selectmenu('refresh', true);
    }

    if (prefs.showmeaning) {
        $("#wordform_meaningcontainer").show();
    }
    else {
        $("#wordform_meaningcontainer").hide();
    }
}

function doPrefsView() {
    $.mobile.changePage($("#prefs"), {transition: "slideup"});

    $("#lf_host").val(prefs.lfhost);
    $("#lf_project").val(prefs.lfprojectname);
    $("#lf_username").val(prefs.lfusername);
    $("#lf_password").val(prefs.lfpassword);

    $("#word_ws").val(prefs.word_ws);
    $("#meaning_ws").val(prefs.meaning_ws);

    if (prefs.showmeaning) {
        $("#showmeaning").val("show").slider('refresh');
    }
    else {
        $("#showmeaning").val("hide").slider('refresh');
    }
    
    $("#uilanguage").val(prefs.uilanguage).selectmenu('refresh');
    
    for (d in prefs.showdomains) {
    	var key = "#domain-" + d;
    	if (prefs.showdomains[d]) {
    		$(key).prop('checked', true).checkboxradio('refresh');
    	}
    	else {
    		$(key).prop('checked', false).checkboxradio('refresh');
    	}
    }   
}









// helper functions

function addWordToSummaryBox(word) {
    //TODO: make a summary box
    //alert("'" + word + "' added to the summary box!");
}

function resetAddWordForm() {
    $("#wordform_itemid").val("");
    $("#wordform_word").val("");
    $("#wordform_meaning").val("");
}

function updateWordCount(numOfItems) {
    var pluralS = "s";
    // update the word count
    if (numOfItems == 1) pluralS = "";
    var wordcount = $("#listwords_wordcount");
    if (numOfItems < getWordCount()) {
        wordcount.text(numOfItems + " word" + pluralS + " in this domain").attr("data-wordcount", numOfItems);
    }
    else { // showing all words
        wordcount.text(numOfItems + " word" + pluralS + " total").attr("data-wordcount", numOfItems);
    }
}

function decrementWordCount() {
    updateWordCount(parseInt($("#listwords_wordcount").attr("data-wordcount"))-1);
}

// from http://blog.vawterconsultingservices.com/index.cfm/2012/5/13/Refresh-jQuery-Mobile-Listview-Themes-at-Runtime
function changeListViewElementTheme(selector, theme) {
    try {
        $(selector).each(function(){
            try {
                var btn = $(this);
                var ggpar = btn.parent().parent().parent();
                var gggpar = ggpar.parent();
                var th = ggpar.attr("data-theme");
                var nth = theme;
                ggpar.removeClass("ui-btn-up-" + th).addClass("ui-btn-up-" + nth);
                ggpar.removeClass("ui-btn-down-" + th).addClass("ui-btn-down-" + nth);
                ggpar.attr("data-theme", nth);
                gggpar.listview("refresh");
            }catch(exignore){
                //silent catch because this will fail for non initialized lists
                //but thats OK
            }
        });
    }
    catch (ex) {
        alert(ex);
    }
}










// Semantic Domain functions

function getSemdomDescription(id, questionIndex) {
    if (questionIndex) {
        return semdomdata[id].questions[questionIndex];
    }
    return semdomdata[id].questions[0];
}

function getSemdomNumOfDescriptions(id) {
    try {
        return semdomdata[id].questions.length;
    }
    catch(e) {
        return 0;
    }
}

function getSemdomFullName(id) {
	try {
	    return semdomdata[id].abbreviation + ' ' + semdomdata[id]["name"][prefs.uilanguage];
	}
	catch (err) {
		return "undefined id=" + id;
	}
}

/*
function loadSemdomDataFromXml(successCallback) {
    $.get("resources/Ddp4.xml", function(d) {
        $(d).find("option").each(function() {
            var domain = $(this);
            var key = domain.find("key").text();
            var names = {};
            domain.find("name form").each(function() {
                names[ $(this).attr("ws") ] = $(this).text();
            });
            var abbrev = domain.find("abbreviation form").text();
            semdomdata[key] = {
                'id': key,
                'name': names,
                'abbreviation': abbrev,
                'questions': []
            };
        });
    }).fail(function(jqXHR, textStatus) {
        alert("failed to load resources/Ddp4.xml: " + textStatus);
    }).done(function() {
        $.get("resources/Ddp4Questions-en.xml", function(d) {
            $(d).find("semantic-domain").each(function() {
                var questions = [];
                var key = $(this).attr("id");
                $(this).find("question").each(function() {
                    questions.push($(this).text());
                });
                semdomdata[key].questions = questions;
            });
        }).fail(function(jqXHR, textStatus) {
                alert("failed to load resources/Ddp4Questions-en.xml: " + textStatus);
        }).done(successCallback);
    });
}
 */

function loadSelectWithSemdomData(selectobj, hasAll) {
    var html = "";
    if (hasAll) {
        html += "<option value=''>Show All</option>";
    }
    var firstTime = true;
    for (var id in semdomdata) {
    	var majorNum = id.substring(0,1);
    	if (prefs.showdomains[majorNum]) { // only show domains that have been chosen to show
    		
	        if (semdomdata[id].abbreviation.split('.').length - 1 == 1) { // only make major revisions
	            if (!firstTime) {
	                html += "</optgroup>";
	                firstTime = false;
	            }
	            var label = semdomdata[id].abbreviation + ' ' + semdomdata[id].name[prefs.uilanguage];
	            html += "<optgroup label='" + label + "'>";
	        }
	        html += "<option value='" + id + "'>" + getSemdomFullName(id) + "</option>";
    	}
    }
    html += "</optgroup>";
    selectobj.html(html);
}


/*
function writeToJSON() {
    $("#output").text(JSON.stringify(semdomdata));
}
*/








// LF functions
function sendWordsToLF() {
    var items = getAllWordsFromStorage();
    for (x in items) {
        postWordToLF(items[x]);
    }
}

function postWordToLF(item) {
    var apisettings = {host: "api.languageforge.com", user: "chris", password: "lfpassword"};
    alert("Sent " + item.word + " to LF");
}










// storage mapper for LocalStorage
/*
    Items are stored as unique items in webstorage (serialized objects)
    A itemindex will be a single known object in localstorage, used for every access of an item
    itemindex has the following structure

    var itemindex = {
        '0' : {
            'item' : 'the item as an object',
            'index_semdomid' : 'semdomid'
        }
    };

    initialize will read itemindex from localstorage into a global itemindex
    any db modification (add, update, delete) will prompt the itemindex to be updated and written to disk, as well as the change to the item itself in local storage

    any add, update or delete operation to an item needs to update the itemindex as well as the item itself
*/




// storage functions
function initializeLocalStorage() {
    if (Modernizr.localstorage) {
    	
    	// initialize lastdbid
        if (lsexists("lastdbid")) {
            lastdbid = parseInt(lsread("lastdbid"));
        } else {
            lastdbid = 0;
        }
        
        // initialize itemindex
        if (lsexists("itemindex")) {
            localStorageItemIndex = JSON.parse(lsread("itemindex"));
        } else {
            localStorageItemIndex = {};
        }
        
        // initialize words
        for (itemid in localStorageItemIndex) {
            words[itemid] = localStorageItemIndex[itemid].item;
        }
        
        // initialize prefs
        if (lsexists("prefs")) {
        	prefs = JSON.parse(lsread("prefs"));
        }
    }
}

function dbid() {
    return lastdbid;
}

function dbid_increment() {
    lastdbid++;
    if (Modernizr.localstorage) {
        lswrite("lastdbid", lastdbid);
    }
}

function lswrite(key, value) {
    window.localStorage[localStorageNamespace + key.toString()] = value.toString();
}

function lsread(key) {
    if (lsexists(key)) {
        return window.localStorage[localStorageNamespace + key.toString()];
    }
    return "";
}

function lsexists(key) {
    if (window.localStorage[localStorageNamespace + key.toString()]) {
        return true;
    }
    return false;
}

function lsremove(key) {
    window.localStorage.removeItem(localStorageNamespace + key.toString());
}

function updateItemIndexInStorage() {
    lswrite("itemindex", JSON.stringify(localStorageItemIndex));
}

function addWordToStorage(word, meaning, semdomid) {
    if (word != "") {
        var dbidstring = dbid().toString();
        var item = {id: dbidstring, word: word, meaning: meaning, semdomid: semdomid};

        // add the item in memory
        words[dbidstring] = item;

        // update the index in memory
        localStorageItemIndex[dbidstring] = {
            item: item,
            index_semdomid: item.semdomid
        };

        if (Modernizr.localstorage) {
            // add the item in storage
            lswrite(dbidstring, JSON.stringify(item));

            // update the index in storage
            updateItemIndexInStorage();
        }

        // increment the dbid
        dbid_increment();
    }
}

function getWordFromStorage(id) {
    return words[id.toString()];
}

function removeWordFromStorage(id) {
    // delete the item from memory
    delete words[id.toString()];

    // update the item index in memory
    delete localStorageItemIndex[id.toString()];

    if (Modernizr.localstorage) {
        // delete the item from storage
        lsremove(id);

        // update the index in storage
        updateItemIndexInStorage();
    }
}

function updateWordInStorage(id, word, meaning, semdomid) {
    if (word != "") {
        var item = getWordFromStorage(id);
        item.word = word;
        item.meaning = meaning;
        item.semdomid = semdomid;

        // update the word in memory
        words[id.toString()] = item;

        // update the index in memory
        localStorageItemIndex[id.toString()] = {
            item: item,
            index_semdomid: semdomid
        };

        if (Modernizr.localstorage) {
            // update the word in storage
            lswrite(id, JSON.stringify(item));

            // update the index in storage
            updateItemIndexInStorage();
        }
    }
}

function getWordsFromStorage(semdomid) {
    if (!semdomid) {  // select all words
        return words;
    }
    var itemsToReturn = {};
    for (itemid in localStorageItemIndex) {
        if (localStorageItemIndex[itemid].index_semdomid == semdomid) {
            itemsToReturn[itemid.toString()] = localStorageItemIndex[itemid].item;
        }
    }
    return itemsToReturn;
}

function getWordCount() {
    var count = 0;
    for (w in words) {
        count++;
    }
    return count;
}

function updatePrefsInStorage() {
	lswrite("prefs", JSON.stringify(prefs));
}