
import FCS from '../node_modules/fcs/fcs.js';
import Plotly from '../node_modules/plotly.js-dist';
import { pinv,multiply,transpose,abs,sign,log10,add,dotMultiply,matrix,median,subtract,exp,sqrt,max,divide,ceil } from '../node_modules/mathjs';
import seedrandom from '../node_modules/seedrandom';

let Instrument = 'Aurora5L';
let custom_unmixing_mtx_fileHandle;
let custom_csvArray;
let custom_ChannelNames;
let inside_csvArray;
let inside_ChannelNames;


let logArray = [];

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
                console.log('custom_csvArray:', custom_csvArray);
                customLog('custom_csvArray:', custom_csvArray);
                custom_ChannelNames = results.meta.fields;
                custom_ChannelNames = custom_ChannelNames.slice(2);
                console.log('custom_ChannelNames:', custom_ChannelNames);
                customLog('custom_ChannelNames:', custom_ChannelNames);
                // check if last row is empty
                if (custom_csvArray.length > 0 && Object.values(custom_csvArray[custom_csvArray.length - 1]).every(value => value === "")) {
                    custom_csvArray.pop(); // remove last row
                }
            },
            error: function(error) {
                console.error('Error parsing CSV:', error);
            }
        });

    } catch (error) {
        console.error('Error reading CSV file:', error);
        customLog('Error reading CSV file:', error);
    }
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
    //read inside unmixing matrix file
    if(Instrument != "Custom"){
        //read inside unmixing matrix file
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
                    console.log('inside_csvArray:', inside_csvArray);
                    customLog('inside_csvArray:', inside_csvArray);
                    inside_ChannelNames = results.meta.fields;
                    inside_ChannelNames = inside_ChannelNames.slice(2);
                    console.log('inside_ChannelNames:', inside_ChannelNames);
                    customLog('inside_ChannelNames:', inside_ChannelNames);
                    // check if last row is empty
                    if (inside_csvArray.length > 0 && Object.values(inside_csvArray[inside_csvArray.length - 1]).every(value => value === "")) {
                        inside_csvArray.pop(); // remove last row
                    }
                },
                error: function(error) {
                    console.error('Error parsing CSV:', error);
                }
            });
        } catch (error) {
            console.error('Error fetching the file:', error);
        }
        //compare inside and custom matrix files

        //merge inside and custom matrix files

    }
    //generate fluors selections


});

function customLog(...args) {
    const timestamp = new Date().toISOString(); // get ISO string of current time
    const logEntry = `[${timestamp}] ${args.join(' ')}`;
    logArray.push(logEntry);
    console.log.apply(console, [logEntry]); 
}

//npm run build