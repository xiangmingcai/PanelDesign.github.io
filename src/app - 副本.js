
import FCS from '../node_modules/fcs/fcs.js';
import Plotly from '../node_modules/plotly.js-dist';
import { pinv,multiply,transpose,abs,sign,log10,add,dotMultiply,matrix,median,subtract,exp,sqrt,max,divide,ceil } from '../node_modules/mathjs';
import seedrandom from '../node_modules/seedrandom';

let fcsfileHandle;
let rawChannels = [];
let unmixedChannels = [];


let logArray = [];
let fcsArray;
let fcsColumnNames = [];

let rawArray;
let unmixedArray;
let unmixedArray_pinv;
let unmixingMtx;


// Select unmixing matrix csv file
document.getElementById('file-input').addEventListener('change', (event) => {
    const fileInput = event.target;
    if (fileInput.files.length > 0) {
        fcsfileHandle = fileInput.files[0];
        const fileName = fcsfileHandle.name;
        document.getElementById('file-name').textContent = `Selected File: ${fileName}`;
        customLog('Selected File: ' + fileName);
        document.getElementById('read-fcs').disabled = false;
    }
});

document.getElementById('read-fcs').addEventListener('click', async () => {
    try {
        await fetchChannel();
        document.getElementById('read-fcs-reminder').innerText = 'Channels in fcs were fetched! Click again if you see no channels below.';
        // empty selection container
        clearSelectionContainers();
        //generate channel selection 
        populateAvailableColumns();

        // show channel selection div
        document.getElementById('selection-div').style.display = 'block';
        // show recover div
        document.getElementById('recover-div').style.display = 'block';
        
    } catch (error) {
        if (fcsfileHandle) {
            document.getElementById('read-fcs-reminder').innerText = 'An error occured, please try again or check log.';
            customLog('Error channel-fetch-button:', error);
        } else {
            document.getElementById('read-fcs-reminder').innerText = 'No file selected. Please select file first.';
            customLog('No file selected. Please select file first.');
        }
        
    }
});

function fetchChannel() {
    return new Promise((resolve, reject) => {
        customLog("fetch Channels");
        
        const file = fcsfileHandle;
        const reader = new FileReader();
        reader.onload = async function(e) {
            //import fcs file
            let arrayBuffer = e.target.result;
            customLog("arrayBuffer: ", "finished.");
            
            let buffer = Buffer.from(arrayBuffer);
            arrayBuffer = null //remove arrayBuffer
            customLog("buffer: ", "finished.");
            
            let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: 1}, buffer);
            buffer = null //remove buffer
            customLog("fcs: ", "finished.");
            
            // fcsColumnNames
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

            fcsColumnNames = columnNames;
            customLog('Column Names:', fcsColumnNames);

            resolve(1);
        };
        reader.onerror = function(error) {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
}

function populateAvailableColumns() {
    const availableColumns = document.getElementById('availableColumns');
    fcsColumnNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.text = name;
        availableColumns.appendChild(option);
    });
}

document.getElementById('moveToRaw-button').addEventListener('click', moveToRaw);
document.getElementById('moveToUnmixed-button').addEventListener('click', moveToUnmixed);
document.getElementById('reset-button').addEventListener('click', resetSelection);

function moveToRaw() {
    moveSelected('availableColumns', 'rawChannels');
    updateChannels('rawChannels', rawChannels);
    updateCounts();
}

function moveToUnmixed() {
    moveSelected('availableColumns', 'unmixedChannels');
    updateChannels('unmixedChannels', unmixedChannels);
    updateCounts();
}

function resetSelection() {
    const availableColumns = document.getElementById('availableColumns');
    const rawChannels = document.getElementById('rawChannels');
    const unmixedChannels = document.getElementById('unmixedChannels');

    // move all selections back to Available Columns
    moveAllOptions(rawChannels, availableColumns);
    moveAllOptions(unmixedChannels, availableColumns);

    rawChannels = [];
    unmixedChannels = [];
    updateCounts();
}

function moveAllOptions(fromSelect, toSelect) {
    const options = Array.from(fromSelect.options);
    options.forEach(option => {
        fromSelect.removeChild(option);
        toSelect.appendChild(option);
    });

}

function moveSelected(fromId, toId) {
    const fromSelect = document.getElementById(fromId);
    const toSelect = document.getElementById(toId);
    const selectedOptions = Array.from(fromSelect.selectedOptions);
    selectedOptions.forEach(option => {
        fromSelect.removeChild(option);
        toSelect.appendChild(option);
    });
}

function clearSelectionContainers() {
    document.getElementById('availableColumns').innerHTML = '';
    document.getElementById('rawChannels').innerHTML = '';
    document.getElementById('unmixedChannels').innerHTML = '';
}

function updateChannels(selectId, channelArray) {
    const select = document.getElementById(selectId);
    channelArray.length = 0; // empty channelArray
    Array.from(select.options).forEach(option => {
        channelArray.push(option.value);
    });
    console.log(`${selectId} updated:`, channelArray);
}

function updateCounts() {
    document.getElementById('rawCount').innerText = document.getElementById('rawChannels').options.length;
    document.getElementById('unmixedCount').innerText = document.getElementById('unmixedChannels').options.length;
}

document.getElementById('recover-button').addEventListener('click', async () => {
    try {
        //recover unmixing matrix
        RecoverMatrix();
        //update recover results

        //show unmixing matrix
        
        
    } catch (error) {
        document.getElementById('recover-reminder').innerText = 'An error occured, please try again or check log.';
        customLog('Error channel-fetch-button:', error);
    }
});

async function RecoverMatrix() {
    //check if rawChannels and unmixedChannels are empty
    if (!rawChannels || !unmixedChannels || rawChannels.length === 0 || unmixedChannels.length === 0) {
        console.error('rawChannels or unmixedChannels are empty');
        customLog('rawChannels or unmixedChannels are empty');
        return;
    }
    //fetch rawArray and unmixedArray and recover unmixingMtx
    await fetchArray();

    
    // show save-button-div
    document.getElementById('save-button-div').style.display = 'block';
}




function fetchArray() {
    return new Promise((resolve, reject) => {
        customLog("fetch Array");
        const file = fcsfileHandle;
        const reader = new FileReader();
        reader.onload = async function(e) {
            //import fcs file
            let arrayBuffer = e.target.result;
            customLog("arrayBuffer: ", "finished.");
            
            let buffer = Buffer.from(arrayBuffer);
            arrayBuffer = null //remove arrayBuffer
            customLog("buffer: ", "finished.");
            
            let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: -1}, buffer);
            buffer = null //remove buffer
            customLog("fcs: ", "finished.");
            
            let fcsArray_full = fcs.dataAsNumbers; 
            fcs = null;
            for (let i = 0; i < 10; i++){
                customLog("recover loop: ", i);
                //fcsArray = generateSubset(fcsArray_full,1000,i,"getRandomSubset",unmixedChannels,fcsColumnNames)
                fcsArray = generateSubset(fcsArray_full,2000,i,"getAllMaxSubset",unmixedChannels,fcsColumnNames)
                // Find indices of rawChannels and unmixedChannels in fcsColumnNames
                let rawIndices = rawChannels.map(name => fcsColumnNames.indexOf(name));
                let unmixedIndices = unmixedChannels.map(name => fcsColumnNames.indexOf(name));

                //seperate rawArray from fcsArray based on the column index of rawChannels in fcsColumnNames
                rawArray = fcsArray.map(row => rawIndices.map(index => row[index]));
                //seperate unmixedArray from fcsArray based on the column index of unmixedChannels in fcsColumnNames
                unmixedArray = fcsArray.map(row => unmixedIndices.map(index => row[index]));

                rawArray = rawArray.map(obj => Object.values(obj));
                rawArray = rawArray.map(row => row.map(Number));
                rawArray = transpose(rawArray);

                unmixedArray = unmixedArray.map(obj => Object.values(obj));
                unmixedArray = unmixedArray.map(row => row.map(Number));
                unmixedArray = transpose(unmixedArray);

                //calculate unmixedArray_pinv
                unmixedArray_pinv = pinv(unmixedArray);

                //calculate unmixingMtx
                let unmixingMtx_tmp = multiply(rawArray, unmixedArray_pinv);
                //customLog("unmixingMtx_tmp: ", unmixingMtx_tmp);
                if (i==0){
                    unmixingMtx = unmixingMtx_tmp;
                }else{
                    unmixingMtx = add(unmixingMtx,unmixingMtx_tmp);
                }
            }
            unmixingMtx = divide(unmixingMtx,10);
            unmixingMtx = transpose(unmixingMtx);

            customLog("unmixingMtx: ", unmixingMtx);
            console.log("unmixingMtx: ", unmixingMtx);

            resolve(1);
        };
        reader.onerror = function(error) {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
}

function getRandomSubset(array, size, seed) {
    const random = seedrandom(seed);
    const shuffled = array.slice(0);
    let i = array.length;
    let min = i - size;
    let temp, index;

    while (i-- > min) {
        index = Math.floor((i + 1) * random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }

    return shuffled.slice(min);
}
function generateSubset(fcsArrayInput,PlotCellSize,SubsetMethod,seed,selectedChannels,allChannels){
    var Plotset
    if (fcsArrayInput.length > PlotCellSize) {
        if (SubsetMethod = "getRandomSubset"){
            Plotset = getRandomSubset(fcsArrayInput, PlotCellSize, seed);
        }else if (SubsetMethod = "getAllMaxSubset"){
            Plotset = getAllMaxSubset(fcsArrayInput, PlotCellSize, selectedChannels, allChannels);
        }
        
    } else if (fcsArrayInput.length == 0){
        console.error('fcsArrayInput is empty');
        customLog('fcsArrayInput is empty');
    } else {
        Plotset = fcsArrayInput
    }
    //console.log('Subset Data:', Plotset); 
    customLog('Row number of Subset Data:', Plotset.length);
    customLog('Column number of Subset Data:', Plotset[0].length);
    return Plotset
}


function getAllMaxSubset(array, size, selectedChannels, allChannels) {
    // 准备空的
    let TopRowIndices = [];

    // 计算每个selectedChannel对应的size
    let SizeEachChannel = ceil(size / selectedChannels.length);

    // 计算selectedChannels在allChannels中的indices
    let selectedIndices = selectedChannels.map(channel => allChannels.indexOf(channel));

    // 根据每个indice，在array这个二维array中取对应列，并计算该列中top SizeEachChannel所在的行indices,并加入到TopRowIndices中
    selectedIndices.forEach(index => {
        let column = array.map(row => row[index]);
        let sortedIndices = column.map((value, idx) => [value, idx])
                                  .sort((a, b) => b[0] - a[0])
                                  .slice(0, SizeEachChannel)
                                  .map(item => item[1]);
        TopRowIndices.push(...sortedIndices);
    });

    // 去掉TopRowIndices中的重复项
    TopRowIndices = [...new Set(TopRowIndices)];

    // 取array中TopRowIndices的子集
    let subset = TopRowIndices.map(rowIndex => array[rowIndex]);

    return subset;
}


document.getElementById('save-button').addEventListener('click', () => {
    
    //insert unmixedChannels as the first column into unmixingMtx
    const unmixedChannelsColumn = unmixedChannels.map(channel => [channel]);
    let unmixingMtxWithChannels = unmixingMtx.map((row, index) => [unmixedChannelsColumn[index], ...row]);
    unmixingMtxWithChannels = unmixingMtxWithChannels.map((row, index) => [unmixedChannelsColumn[index], ...row]);
    // Convert array to CSV format
    const csvHeader = ['Primary','Secondary', ...rawChannels].join(',');

    const csvContent = unmixingMtxWithChannels.map(row => row.join(',')).join('\n');
    const csvData = `${csvHeader}\n${csvContent}`;

    // Create a blob from the CSV content
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

    // Create a link element
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'recovered_unmixing_mtx.csv';

    // Append the link to the body
    document.body.appendChild(link);

    // Programmatically click the link to trigger the download
    link.click();

    // Remove the link from the body
    document.body.removeChild(link);
});



function customLog(...args) {
    const timestamp = new Date().toISOString(); // get ISO string of current time
    const logEntry = `[${timestamp}] ${args.join(' ')}`;
    logArray.push(logEntry);
    console.log.apply(console, [logEntry]); 
}

document.getElementById('export-log-button').addEventListener('click', () => {
    const logContent = logArray.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'console_log.txt';
    a.click();
    URL.revokeObjectURL(url);
});

//npm run build