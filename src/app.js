
import FCS from '../node_modules/fcs/fcs.js';
import Plotly from '../node_modules/plotly.js-dist';
import { pinv,multiply,transpose,abs,sign,log10,add,dotMultiply,matrix,median,subtract,exp,sqrt,max,divide,ceil } from '../node_modules/mathjs';
import seedrandom from '../node_modules/seedrandom';

let Instrument = 'Aurora5L';
let custom_unmixing_mtx_fileHandle;
let custom_csvArray;
let custom_ChannelNames;
let custom_Primary_fluors;
let custom_Secondary_fluors;
let inside_unmixing_mtx_fileHandle;
let inside_csvArray;
let inside_ChannelNames;
let inside_Primary_fluors;
let inside_Secondary_fluors;
let logArray = [];
let matrixCompare_check = false;

let merged_csvArray;
let merged_Primary_fluors;
let merged_Secondary_fluors;
let merged_ChannelNames;
let checkboxFluorsContainer;
let checkboxChannelsContainer;
let selectedIndices = [];
let selected_Secondary_fluors;
let selected_Primary_fluors;
let selected_ChannelNames = [];
let fluor_fcs_pairs = [];
let selected_custom_Secondary_fluors;
let customfileInputContainer;
let use_all_channel = true;
let inside_fcs_fileHandle;

let directoryHandle;
let fcsdirectoryHandle;

// select Instrument
const selectInstrumentElement = document.getElementById('instrument-select');
selectInstrumentElement.addEventListener('change', function() {
    Instrument = selectInstrumentElement.value;
    console.log('Selected instrument:', Instrument);
});

// Select custom unmixing matrix csv file
document.getElementById('custom-unmixing-file-input').addEventListener('change', (event) => {
    const fileInput = event.target;
    if (fileInput.files.length > 0) {
        custom_unmixing_mtx_fileHandle = fileInput.files[0];
        const fileName = custom_unmixing_mtx_fileHandle.name;
        document.getElementById('custom-unmixing-file-name').textContent = `Selected File: ${fileName}`;
        customLog('Selected File: ' + fileName);
    }
});

// Read unmixing matrix csv file
document.getElementById('read-custom-unmixing-file').addEventListener('click', async () => {
    await readcustomcsv()
});


//to do: update UnmixingMtxModel.csv for various instruments
//download unmixing-model-file
document.getElementById('unmixing-model-file-download-button').addEventListener('click', function() {
    if (Instrument=='Aurora5L'){
        let model_filename = 'Aurora5LUnmixingMtxModel.csv';
    }
    else if(Instrument=='Xenith'){
        let model_filename = 'Aurora5LUnmixingMtxModel.csv';
    }
    else if(Instrument=='CytPix'){
        let model_filename = 'Aurora5LUnmixingMtxModel.csv';
    }
    else if(Instrument=='Fortessa'){
        let model_filename = 'Aurora5LUnmixingMtxModel.csv';
    }
    else if(Instrument=='Custom'){
        let model_filename = 'Aurora5LUnmixingMtxModel.csv';
    }
    const link = document.createElement('a');
    link.href = 'data/mtx/' + model_filename;
    link.download = model_filename;
    link.click();
});

//Generate fluors
document.getElementById('generate-fluors-selection').addEventListener('click', async () => {
    if (Instrument == 'Custom') {
        if (custom_csvArray && custom_csvArray.length > 0) {
            document.getElementById("custom_csvArray-check").innerText = ``;
            merged_csvArray = [...custom_csvArray];
            merged_Primary_fluors = [...custom_Primary_fluors];
            merged_Secondary_fluors = [...custom_Secondary_fluors];
            merged_ChannelNames = [...custom_ChannelNames];
            console.log("merged_csvArray: ", merged_csvArray);
            console.log("merged_Primary_fluors: ", merged_Primary_fluors);
            console.log("merged_Secondary_fluors: ", merged_Secondary_fluors);
            console.log("merged_ChannelNames: ", merged_ChannelNames);
            matrixCompare_check = true;
        } else {
            //error submit custom_csvArray first
            document.getElementById("custom_csvArray-check").innerText = `Please submit custom unmixing matrix file first.`;
            matrixCompare_check = false;
        }
    } else {
        //read inside unmixing matrix file
        await readinsidecsv(); //for official use
        //await readinsidecsv_test(); //for local test

        //compare inside and custom matrix files
        if (custom_csvArray && custom_csvArray.length > 0) {
            matrixCompare_check = false;
            matrixCompare();
        } else {
            matrixCompare_check = true;
        }
        customLog('matrixCompare_check:', matrixCompare_check);

        //merge inside and custom matrix files
        if (custom_csvArray && custom_csvArray.length > 0) {
            if (matrixCompare_check) {
                merged_csvArray = [...inside_csvArray, ...custom_csvArray];
                merged_Primary_fluors = [...inside_Primary_fluors, ...custom_Primary_fluors];
                merged_Secondary_fluors = [...inside_Secondary_fluors, ...custom_Secondary_fluors];
                merged_ChannelNames = [...inside_ChannelNames];
            }
            console.log("merged_csvArray: ", merged_csvArray);
            console.log("merged_Primary_fluors: ", merged_Primary_fluors);
            console.log("merged_Secondary_fluors: ", merged_Secondary_fluors);
            console.log("merged_ChannelNames: ", merged_ChannelNames);
        } else {
            merged_csvArray = [...inside_csvArray];
            merged_Primary_fluors = [...inside_Primary_fluors];
            merged_Secondary_fluors = [...inside_Secondary_fluors];
            merged_ChannelNames = [...inside_ChannelNames];
            console.log("merged_csvArray: ", merged_csvArray);
            console.log("merged_Primary_fluors: ", merged_Primary_fluors);
            console.log("merged_Secondary_fluors: ", merged_Secondary_fluors);
            console.log("merged_ChannelNames: ", merged_ChannelNames);
        }
    }
    

    //generate fluors selections
    if (matrixCompare_check) {
        checkboxFluorsContainer = document.getElementById('fluors-checkbox-container');
        checkboxFluorsContainer.innerHTML = ''; 
        merged_Secondary_fluors.forEach((fluor, index) => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = index;
            checkbox.addEventListener('change', updateSelectedFluorIndices);
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(fluor));
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'checkbox-item';
            checkboxItem.appendChild(label);
            checkboxFluorsContainer.appendChild(checkboxItem);
        });
        document.getElementById('fluors-selection-div').style.display = 'block';
    }
    //set default selected_ChannelNames
    selected_ChannelNames = [...merged_ChannelNames]
    console.log('selected_ChannelNames:', selected_ChannelNames);

});
 
async function readinsidecsv(){
    
    const filePath = `data/mtx/${Instrument}.csv`;
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const csvText = await response.text();
        Papa.parse(csvText, {
            header: true,
            complete: function(results) {
                inside_csvArray = results.data;
                // check if last row is empty
                if (inside_csvArray.length > 0 && Object.values(inside_csvArray[inside_csvArray.length - 1]).every(value => value === "")) {
                    inside_csvArray.pop(); // remove last row
                }
                console.log('inside_csvArray:', inside_csvArray);
                customLog('inside_csvArray:', inside_csvArray);
                inside_ChannelNames = results.meta.fields;
                inside_ChannelNames = inside_ChannelNames.slice(2);
                console.log('inside_ChannelNames:', inside_ChannelNames);
                customLog('inside_ChannelNames:', inside_ChannelNames);
                inside_Primary_fluors = inside_csvArray.map(item => item.Primary)
                inside_Secondary_fluors = inside_csvArray.map(item => item.Secondary)
                console.log('inside_Primary_fluors:', inside_Primary_fluors);
                customLog('inside_Primary_fluors:', inside_Primary_fluors);
                console.log('inside_Secondary_fluors:', inside_Secondary_fluors);
                customLog('inside_Secondary_fluors:', inside_Secondary_fluors);
                
            },
            error: function(error) {
                console.error('Error parsing CSV:', error);
            }
        });
    } catch (error) {
        console.error('Error fetching the file:', error);
    }
}

//for local test
async function readinsidecsv_test(){
    directoryHandle = await window.showDirectoryPicker();
    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name === `${Instrument}.csv`) {
            inside_unmixing_mtx_fileHandle = await entry.getFile();
        }
    }

    try {
        if (!inside_unmixing_mtx_fileHandle) {
            alert('Please select a file first.');
            return;
        }

        // Read the file
        const text = await inside_unmixing_mtx_fileHandle.text();
        
        // Parse CSV content using PapaParse
        Papa.parse(text, {
            header: true,
            complete: function(results) {
                inside_csvArray = results.data;
                // check if last row is empty
                if (inside_csvArray.length > 0 && Object.values(inside_csvArray[inside_csvArray.length - 1]).every(value => value === "")) {
                    inside_csvArray.pop(); // remove last row
                }
                console.log('inside_csvArray:', inside_csvArray);
                customLog('inside_csvArray:', inside_csvArray);
                inside_ChannelNames = results.meta.fields;
                inside_ChannelNames = inside_ChannelNames.slice(2);
                console.log('inside_ChannelNames:', inside_ChannelNames);
                customLog('inside_ChannelNames:', inside_ChannelNames);
                inside_Primary_fluors = inside_csvArray.map(item => item.Primary)
                inside_Secondary_fluors = inside_csvArray.map(item => item.Secondary)
                console.log('inside_Primary_fluors:', inside_Primary_fluors);
                customLog('inside_Primary_fluors:', inside_Primary_fluors);
                console.log('inside_Secondary_fluors:', inside_Secondary_fluors);
                customLog('inside_Secondary_fluors:', inside_Secondary_fluors);
                
            },
            error: function(error) {
                console.error('Error parsing CSV:', error);
            }
        });

    } catch (error) {
        console.error('Error reading CSV file:', error);
        customLog('Error reading CSV file:', error);
    }
}

async function readcustomcsv(){
    try {
        if (!custom_unmixing_mtx_fileHandle) {
            alert('Please select a file first.');
            return;
        }

        // Read the file
        const text = await custom_unmixing_mtx_fileHandle.text();
        
        // Parse CSV content using PapaParse
        Papa.parse(text, {
            header: true,
            complete: function(results) {
                custom_csvArray = results.data;
                // check if last row is empty
                if (custom_csvArray.length > 0 && Object.values(custom_csvArray[custom_csvArray.length - 1]).every(value => value === "")) {
                    custom_csvArray.pop(); // remove last row
                }
                console.log('custom_csvArray:', custom_csvArray);
                customLog('custom_csvArray:', custom_csvArray);
                custom_ChannelNames = results.meta.fields;
                custom_ChannelNames = custom_ChannelNames.slice(2);
                custom_Primary_fluors = custom_csvArray.map(item => item.Primary)
                custom_Secondary_fluors = custom_csvArray.map(item => item.Secondary)
                console.log('custom_Primary_fluors:', custom_Primary_fluors);
                customLog('custom_Primary_fluors:', custom_Primary_fluors);
                console.log('custom_Secondary_fluors:', custom_Secondary_fluors);
                customLog('custom_Secondary_fluors:', custom_Secondary_fluors);
                console.log('custom_ChannelNames:', custom_ChannelNames);
                customLog('custom_ChannelNames:', custom_ChannelNames);
                
            },
            error: function(error) {
                console.error('Error parsing CSV:', error);
            }
        });

        document.getElementById("read-custom-unmixing-file-reminder").innerText = "csv file read."

    } catch (error) {
        console.error('Error reading CSV file:', error);
        customLog('Error reading CSV file:', error);
    }
}

function matrixCompare(){
    //compare primaryFluor
    let conflicts_Primary_fluors = custom_Primary_fluors.filter(fluor => inside_Primary_fluors.includes(fluor));
    console.log('conflicts_Primary_fluors:', conflicts_Primary_fluors);
    if (conflicts_Primary_fluors.length > 0) {
        document.getElementById("matrix-compare-check-fluors-primary").innerText = `Conflicting primary name found: ${conflicts_Primary_fluors.join(', ')}. Please adjust first.`;
    } else {
        document.getElementById("matrix-compare-check-fluors-primary").innerText = `All fluor primary names checked.`;
    }
    //compare seconodaryFluor
    let conflicts_Secondary_fluors = custom_Secondary_fluors.filter(fluor => inside_Secondary_fluors.includes(fluor));
    console.log('conflicts_Secondary_fluors:', conflicts_Secondary_fluors);
    if (conflicts_Secondary_fluors.length > 0) {
        document.getElementById("matrix-compare-check-fluors-secondary").innerText = `Conflicting secondary name found: ${conflicts_Secondary_fluors.join(', ')}. Please adjust first.`;
    } else {
        document.getElementById("matrix-compare-check-fluors-secondary").innerText = `All fluor secondary names checked.`;
    }
    //compare channels
    let missingChannels = inside_ChannelNames.filter(channel => !custom_ChannelNames.includes(channel));
    let extraChannels = custom_ChannelNames.filter(channel => !inside_ChannelNames.includes(channel));
    if (missingChannels.length > 0 || extraChannels.length > 0) {
        if (missingChannels.length > 0){
            document.getElementById("matrix-compare-check-channels-missing").innerText = `Missing channels found: ${missingChannels.join(', ')}. Please check first.`;
        }
        if (extraChannels.length > 0){
            document.getElementById("matrix-compare-check-channels-extra").innerText = `Extra channels found: ${extraChannels.join(', ')}. Please check first.`;
        }
    } else {
        document.getElementById("matrix-compare-check-channels-missing").innerText ="";
        document.getElementById("matrix-compare-check-channels-extra").innerText ="All channel names checked.";
    }

    if (conflicts_Primary_fluors.length == 0 && conflicts_Secondary_fluors.length == 0 && missingChannels.length == 0 && extraChannels.length == 0){
        matrixCompare_check = true;
    }
}

// update selected Fluor Indices
function updateSelectedFluorIndices() {
    selectedIndices = [];
    const checkboxes = checkboxFluorsContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
        selectedIndices.push(parseInt(checkbox.value));
    }
    });
    document.getElementById('fluors-selection-reminder').innerText = `A total of ${selectedIndices.length} fluors were selected.`
    customLog('selectedIndices:', selectedIndices);
}

// parse input fluors names text and check checkbox
document.getElementById('parse-input-fluor-names-text-botton').addEventListener('click', parseInput);
function parseInput() {
    const inputText = document.getElementById('fluor-input').value;
    const inputLines = inputText.split('\n');
    const checkboxes = checkboxFluorsContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false; // unselect all checkbox
    });
    inputLines.forEach(line => {
        const index = merged_Secondary_fluors.indexOf(line.trim());
        if (index !== -1) {
        checkboxes[index].checked = true;
        }
    });
    updateSelectedFluorIndices();
}
// confirm fluors selection, match custom fcs file and select channels
document.getElementById('confirm-fluors-selection').addEventListener('click', async () => {
    selected_Primary_fluors = selectedIndices.map(index => merged_Primary_fluors[index])
    selected_Secondary_fluors = selectedIndices.map(index => merged_Secondary_fluors[index])
    console.log("selected_Primary_fluors: ",selected_Primary_fluors);
    console.log("selected_Secondary_fluors: ",selected_Secondary_fluors);
    
    //initial empty fluor_fcs_pairs
    fluor_fcs_pairs = [];
    document.getElementById('custom-fcs-file-input-container').innerHTML = ''; 

    //generate fluor_fcs_pairs to store Indice, Primary, Secondary, fcs_address for each selected fluor
    selectedIndices.forEach(index => {
        const fluor_fcs_pair = {
        Indice: index,
        Primary: merged_Primary_fluors[index],
        Secondary: merged_Secondary_fluors[index],
        custom: false,
        fcs_address: `data/fcs/${Instrument}/${merged_Primary_fluors[index]}.fcs`,
        fcs_Array: null
        };
        fluor_fcs_pairs.push(fluor_fcs_pair);
    });
    
    //match custom fcs file
    if (custom_csvArray && custom_csvArray.length > 0) {
        // check if any selected_Secondary_fluors are in custom_Secondary_fluors
        selected_custom_Secondary_fluors = selected_Secondary_fluors.filter(fluor => custom_Secondary_fluors.includes(fluor));
        //if so, empty the fcs_address value of corresponding fluor in fluor_fcs_pairs
        fluor_fcs_pairs.forEach(pair => {
            if (selected_custom_Secondary_fluors.includes(pair.Secondary)) {
                pair.custom = true; 
                pair.fcs_address = ""; 
            }
        });
    }
    console.log("fluor_fcs_pairs: ",fluor_fcs_pairs);
    
    // generate file input container and read fcs from custom fluors
    if (custom_csvArray && custom_csvArray.length > 0) {
        if (selected_custom_Secondary_fluors.length > 0) {
            customfileInputContainer = document.getElementById('custom-fcs-file-input-container');
            customfileInputContainer.innerHTML = ''; 
            selected_custom_Secondary_fluors.forEach((fluor, index) => {
                const fileInputLabel = document.createElement('label');
                fileInputLabel.textContent = `Select fcs file for ${fluor}: `;
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.addEventListener('change', (event) => handleCustomFCSFileInputChange(event, fluor));
                const fileCheck = document.createElement('p');
                const fileInputItem = document.createElement('div');
                fileInputItem.appendChild(fileInputLabel);
                fileInputItem.appendChild(fileInput);
                fileInputItem.appendChild(fileCheck);
                customfileInputContainer.appendChild(fileInputItem);
            });
        }
    }
    

    // show 
    document.getElementById('panel-evaluation-button-div').style.display = 'block';

});

function handleCustomFCSFileInputChange(event, fluor) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            //import fcs file
            let arrayBuffer = e.target.result;
            customLog("arrayBuffer: ", "finished.");
            
            let buffer = Buffer.from(arrayBuffer);
            arrayBuffer = null //remove arrayBuffer
            customLog("buffer: ", "finished.");
            
            let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: 10000}, buffer);
            buffer = null //remove buffer
            customLog("fcs: ", "finished.");
            
            //find columnNames
            const text = fcs.text;
            const columnNames = [];
            //columnNames are stored in `$P${i}S` in Xenith
            for (let i = 1; text[`$P${i}S`]; i++) {
                columnNames.push(text[`$P${i}S`]);
            }
            //columnNames are stored in `$P${i}N` in Aurora
            if (columnNames.length == 0) {
                for (let i = 1; text[`$P${i}N`]; i++) {
                    columnNames.push(text[`$P${i}N`]);
                }
            }
            //check if all selected_ChannelNames are in columnNames, if not, report on webpage
            
            const missingChannels = selected_ChannelNames.filter(name => !columnNames.includes(name));
            const fileCheck = event.target.nextElementSibling;
            if (missingChannels.length > 0) {
                fileCheck.textContent = `Missing channels: ${missingChannels.join(', ')}; Please check first.`;
            } else {
                fileCheck.textContent = '';
            }

            //extract fcsArray
            let fcsArray = fcs.dataAsNumbers; 
            fcs = null;

            let rowIndices = selected_ChannelNames.map(name => columnNames.indexOf(name));
            fcsArray = fcsArray.map(row => rowIndices.map(index => row[index]));
            fcsArray = transpose(fcsArray);

            //store fcsArray in fluor_fcs_pairs
            const pairIndex = fluor_fcs_pairs.findIndex(pair => pair.Secondary === fluor);
            if (pairIndex !== -1) {
                fluor_fcs_pairs[pairIndex].fcs_Array = fcsArray;
                console.log("updated fluor_fcs_pairs: ",fluor_fcs_pairs);
            }

        }
        reader.readAsArrayBuffer(file);
    }
}

document.getElementById('use-all-channel-checkbox').addEventListener('change', function() {
    use_all_channel = document.getElementById('use-all-channel-checkbox').checked;
    if (use_all_channel) {
        selected_ChannelNames = [...merged_ChannelNames];
        document.getElementById('channels-checkbox-container').innerHTML = '';
        document.getElementById('channels-selection-reminder').innerText = `A total of ${selected_ChannelNames.length} channels were selected.`
    } else {
        generateChannelCheckboxes();
    }
    console.log('use_all_channel:', use_all_channel);
    console.log('selected_ChannelNames:', selected_ChannelNames);
});

function generateChannelCheckboxes(){
    checkboxChannelsContainer = document.getElementById('channels-checkbox-container');
    checkboxChannelsContainer.innerHTML = ''; 
    merged_ChannelNames.forEach((channel, index) => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = index;
        checkbox.checked = true;
        checkbox.addEventListener('change', updateSelectedChannels);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(channel));
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        checkboxItem.appendChild(label);
        checkboxChannelsContainer.appendChild(checkboxItem);
    });
}

// update selected Channels
function updateSelectedChannels() {
    selected_ChannelNames = [];
    const checkboxes = checkboxChannelsContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selected_ChannelNames.push(merged_ChannelNames[parseInt(checkbox.value)]);
        }
    });
    document.getElementById('channels-selection-reminder').innerText = `A total of ${selected_ChannelNames.length} channels were selected.`
    console.log('selected_ChannelNames:', selected_ChannelNames);
}

document.getElementById('panel_evaluation_button').addEventListener('click', async () => {
    //readallinsidefcs_test();
    readallinsidefcs();
})

//read inside fcs
async function readallinsidefcs(){
    fluor_fcs_pairs.forEach(async pair => {
        if (!pair.custom) {
            await readinsidefcs(pair.fcs_address,pair.Primary)
        }
    });
}

async function readinsidefcs(fcsAddress, fluorPrimary) {
    try {
        const response = await fetch(fcsAddress);
        if (!response.ok) {
            throw new Error(`Failed to fetch FCS file: ${response.statusText}`);
        }

        let arrayBuffer = await response.arrayBuffer();
        customLog("arrayBuffer: ", "finished.");
        
        let buffer = Buffer.from(arrayBuffer);
        arrayBuffer = null //remove arrayBuffer
        customLog("buffer: ", "finished.");
        
        let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: 10000}, buffer);
        buffer = null //remove buffer
        
        //find columnNames
        const text = fcs.text;
        const columnNames = [];
        //columnNames are stored in `$P${i}S` in Xenith
        for (let i = 1; text[`$P${i}S`]; i++) {
            columnNames.push(text[`$P${i}S`]);
        }
        //columnNames are stored in `$P${i}N` in Aurora
        if (columnNames.length == 0) {
            for (let i = 1; text[`$P${i}N`]; i++) {
                columnNames.push(text[`$P${i}N`]);
            }
        }
        //check if all selected_ChannelNames are in columnNames, if not, report on webpage
        
        const missingChannels = selected_ChannelNames.filter(name => !columnNames.includes(name));
        if (missingChannels.length > 0) {
            customLog(`Missing channels: ${missingChannels.join(', ')}; Please check first.`);
        }

        //extract fcsArray
        let fcsArray = fcs.dataAsNumbers; 
        fcs = null;

        let rowIndices = selected_ChannelNames.map(name => columnNames.indexOf(name));
        fcsArray = fcsArray.map(row => rowIndices.map(index => row[index]));
        fcsArray = transpose(fcsArray);

        //store fcsArray in fluor_fcs_pairs
        const pairIndex = fluor_fcs_pairs.findIndex(pair => pair.Primary === fluorPrimary);
        if (pairIndex !== -1) {
            fluor_fcs_pairs[pairIndex].fcs_Array = fcsArray;
            console.log("updated fluor_fcs_pairs: ",fluor_fcs_pairs);
        }


    } catch (error) {
        console.error('Error reading FCS file:', error);
    }
}

async function readallinsidefcs_test() {
    fcsdirectoryHandle = await window.showDirectoryPicker();
    fluor_fcs_pairs.forEach(async pair => {
        if (!pair.custom) {
            await readinsidefcs_test(fcsdirectoryHandle,Instrument,pair.Primary)
        }
    });
}
async function readinsidefcs_test(fcsdirectoryHandle,Instrument,fluorPrimary) {
    console.log(`${fluorPrimary}.fcs`);
    for await (const entry of fcsdirectoryHandle.values()) {
        if (entry.kind === 'file' && entry.name === `${fluorPrimary}.fcs`) {
            inside_fcs_fileHandle = await entry.getFile();
        }
    }
    console.log("inside_fcs_fileHandle: ",inside_fcs_fileHandle);
    const file = inside_fcs_fileHandle;
    const reader = new FileReader();
    reader.onload = function(e) {
        //import fcs file
        let arrayBuffer = e.target.result;
        customLog("arrayBuffer: ", "finished.");
        
        let buffer = Buffer.from(arrayBuffer);
        arrayBuffer = null //remove arrayBuffer
        customLog("buffer: ", "finished.");
        
        let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: 10000}, buffer);
        buffer = null //remove buffer

        //find columnNames
        const text = fcs.text;
        const columnNames = [];
        //columnNames are stored in `$P${i}S` in Xenith
        for (let i = 1; text[`$P${i}S`]; i++) {
            columnNames.push(text[`$P${i}S`]);
        }
        //columnNames are stored in `$P${i}N` in Aurora
        if (columnNames.length == 0) {
            for (let i = 1; text[`$P${i}N`]; i++) {
                columnNames.push(text[`$P${i}N`]);
            }
        }
        //check if all selected_ChannelNames are in columnNames, if not, report on webpage
        
        const missingChannels = selected_ChannelNames.filter(name => !columnNames.includes(name));
        if (missingChannels.length > 0) {
            customLog(`Missing channels: ${missingChannels.join(', ')}; Please check first.`);
        }

        //extract fcsArray
        let fcsArray = fcs.dataAsNumbers; 
        fcs = null;

        let rowIndices = selected_ChannelNames.map(name => columnNames.indexOf(name));
        fcsArray = fcsArray.map(row => rowIndices.map(index => row[index]));
        fcsArray = transpose(fcsArray);

        //store fcsArray in fluor_fcs_pairs
        const pairIndex = fluor_fcs_pairs.findIndex(pair => pair.Primary === fluorPrimary);
        if (pairIndex !== -1) {
            fluor_fcs_pairs[pairIndex].fcs_Array = fcsArray;
            console.log("updated fluor_fcs_pairs: ",fluor_fcs_pairs);
        }
    }
    reader.readAsArrayBuffer(file);
}

function customLog(...args) {
    const timestamp = new Date().toISOString(); // get ISO string of current time
    const logEntry = `[${timestamp}] ${args.join(' ')}`;
    logArray.push(logEntry);
    console.log.apply(console, [logEntry]); 
}

//npm run build
