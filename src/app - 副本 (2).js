
import FCS from '../node_modules/fcs/fcs.js';
import Plotly from '../node_modules/plotly.js-dist';
import { pinv,multiply,transpose,abs,sign,log10,add,dotMultiply,matrix,median,subtract,exp,sqrt,max } from '../node_modules/mathjs';
import seedrandom from '../node_modules/seedrandom';

let matrix_available;
let PrimaryName;
let SecondaryName;
let peakChannel;
let selectedSeusetChannelName;
let selectedsigMethod = "PN";


let pos_sig;
let neg_sig;
let final_sig;
let plot_title;
let elementid;

let logArray = [];

let directoryHandle;
let UnmixfileHandle;
let csvArray;
let ChannelNames;


let SCCfileHandle;
let fcsArray = [];
let fcsColumnNames = [];
let fcsArrayPlotset = [];
let SubsetMethod;
let SubsetSize;
let PlotCellSize;
let PlotCellSize_default = 30000;
let x_val = '';
let y_val = '';

let selectedSubset_fcsArray;
let positivefcsArray;
let negativefcsArray;

let enable_density_plot = false;
let checkbox_generated_check = false;

// Select fcs Data folder
document.getElementById('select-folder').addEventListener('click', async () => {
    try {
        // Show the directory picker
        directoryHandle = await window.showDirectoryPicker();
        
        // Get the name of the selected folder
        const folderName = directoryHandle.name;
        
        // Display the folder name
        document.getElementById('folder-name').textContent = `Selected Folder: ${folderName}`;
        
    } catch (error) {
        console.error('Error selecting folder:', error);
        customLog('Error selecting folder:', error);
    }
});

// Select unmixing matrix csv file
document.getElementById('file-input').addEventListener('change', (event) => {
    const fileInput = event.target;
    if (fileInput.files.length > 0) {
        UnmixfileHandle = fileInput.files[0];
        const fileName = UnmixfileHandle.name;
        document.getElementById('file-name').textContent = `Selected File: ${fileName}`;
        customLog('Selected File: ' + fileName);
        document.getElementById('read-csv').disabled = false;
        
    }
});

// Read unmixing matrix csv file
document.getElementById('read-csv').addEventListener('click', async () => {
    try {
        if (!UnmixfileHandle) {
            alert('Please select a file first.');
            return;
        }

        // Read the file
        const text = await UnmixfileHandle.text();
        
        // Parse CSV content using PapaParse
        Papa.parse(text, {
            header: true,
            complete: function(results) {
                csvArray = results.data;
                console.log('CSV Array:', csvArray);
                customLog('CSV Array:', csvArray);
                ChannelNames = results.meta.fields;
                ChannelNames = ChannelNames.slice(2);
                console.log('ChannelNames:', ChannelNames);
                customLog('ChannelNames:', ChannelNames);
                // check if last row is empty
                if (csvArray.length > 0 && Object.values(csvArray[csvArray.length - 1]).every(value => value === "")) {
                    csvArray.pop(); // remove last row
                }
            }
        });

        //show csvArray
        displayCSVTable(csvArray);
        matrix_available = true;
        //show new sig setup div
        document.getElementById('new-sig-setup-div').style.display = 'block';
    } catch (error) {
        console.error('Error reading CSV file:', error);
        customLog('Error reading CSV file:', error);
    }
});

// no-csv file button
document.getElementById('no-csv').addEventListener('click', async () => {
    matrix_available = false;
    //show new sig setup div
    document.getElementById('new-sig-setup-div').style.display = 'block';
});

// Display unmixing matrix csv file
function displayCSVTable(data) {
    const table = document.createElement('table');
    const headerRow = document.createElement('tr');

    // Create table headers
    Object.keys(data[0]).forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Create table rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        Object.values(row).forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });

    // Append table to the div
    document.getElementById('csv-table').innerHTML = '';
    document.getElementById('csv-table').appendChild(table);
}


// Submit New Signature Names
document.getElementById('new-sig-setup-submit-button').addEventListener('click', async () => {
    try {
        PrimaryName = document.getElementById('primaryName').value;
        SecondaryName = document.getElementById('secondaryName').value;
        
        if (!PrimaryName || !SecondaryName) {
            document.getElementById('new-sig-setup-submit-message').innerText = 'Please input PrimaryName and SecondaryName.';
        } else {
            document.getElementById('new-sig-setup-submit-message').innerText = 'PrimaryName: '+ PrimaryName + '; SecondaryName: ' + SecondaryName;
            populateFileDropdown(directoryHandle)
            //show step 2
            document.getElementById('scc-file-setup-div').style.display = 'block';
        }

    } catch (error) {
        document.getElementById('new-sig-setup-submit-message').innerText = 'An error occured, please try again or check log.';
        customLog('Error new-sig-setup-submit:', error);
    }
});

// Show Dropdown to select scc fcs file for positive signature
async function populateFileDropdown(directoryHandle) {
    const fileDropdown = document.getElementById('file-dropdown');
    fileDropdown.innerHTML = '';

    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file') {
            const option = document.createElement('option');
            option.textContent = entry.name;
            option.value = entry.name;
            fileDropdown.appendChild(option);
        }
    }
    //set default
    const selectedFileName = document.getElementById('file-dropdown').value;
    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name === selectedFileName) {
            SCCfileHandle = entry;
            document.getElementById('file-dropdown-name').textContent = `Selected File: ${SCCfileHandle.name}`;
            customLog('Selected File: ' + SCCfileHandle.name);
            break;
        }
    }
    //set eventlistener
    fileDropdown.addEventListener('change', async (event) => {
        const selectedFileName = event.target.value;
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name === selectedFileName) {
                SCCfileHandle = entry;
                document.getElementById('file-dropdown-name').textContent = `Selected File: ${SCCfileHandle.name}`;
                customLog('Selected File: ' + SCCfileHandle.name);
                break;
            }
        }
    });
}

document.getElementById('channel-fetch-button').addEventListener('click', async () => {
    try {
        fetchChannel()
        document.getElementById('channel-fetch-reminder').innerText = 'Channels fetched!';
    } catch (error) {
        document.getElementById('channel-fetch-reminder').innerText = 'An error occured, please try again or check log.';
        customLog('Error channel-fetch-button:', error);
    }
});


async function fetchChannel() {
    if (SCCfileHandle) {
        customLog("fetch Channels");
        const file = await SCCfileHandle.getFile();
        const reader = new FileReader();
        reader.onload = function(e) {
            //import fcs file
            let arrayBuffer = e.target.result;
            customLog("arrayBuffer: ", "finished.");
            
            let buffer = Buffer.from(arrayBuffer);
            arrayBuffer = null //remove arrayBuffer
            customLog("buffer: ", "finished.");
            
            let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: 1000}, buffer);
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
            
            fcsArray = fcs.dataAsNumbers; 
            fcs = null; //remove fcs
            //calcualte the peak channel
            peakChannel = FindPeakChannel(fcsArray, fcsColumnNames)
            
            //generate pulldown channel list
            populateChannelDropdown(fcsColumnNames) 
            setDefaultDropdown("channel-dropdown",peakChannel) 
        };
        reader.readAsArrayBuffer(file);
    } else {
        console.error('No file selected');
        customLog('No file selected');
    }
}

function setDefaultDropdown(elementid,defaultoption) {
    const dropdown = document.getElementById(elementid);
    const options = dropdown.options;
    
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === defaultoption) {
            options[i].selected = true;
            break;
        }
    }
}
// Show Dropdown to select channel for subset
async function populateChannelDropdown(fcsColumnNames) {
    const channelDropdown = document.getElementById('channel-dropdown');
    fcsColumnNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        channelDropdown.appendChild(option);
    });

    channelDropdown.addEventListener('change', async (event) => {
        selectedSeusetChannelName = event.target.value;
        customLog('Selected Channel:', selectedSeusetChannelName);

    });
}


// Read selected scc fcs file
document.getElementById('file-reading-button').addEventListener('click', readFCSFile);

async function readFCSFile() {
    //show file-reading-reminder
    document.getElementById('file-reading-button-reminder-div').style.display = 'block';
    if (SCCfileHandle) {
        const file = await SCCfileHandle.getFile();
        const reader = new FileReader();
        reader.onload = function(e) {
            SubsetMethod = document.querySelector('input[name="subset-method"]:checked').value;
            
            //import fcs file
            let arrayBuffer = e.target.result;
            //console.log("arrayBuffer: ", arrayBuffer);
            customLog("arrayBuffer: ", "finished.");
            
            let buffer = Buffer.from(arrayBuffer);
            console.log("buffer: ", buffer);
            //arrayBuffer = null //remove arrayBuffer
            customLog("buffer: ", "finished.");
            
            let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: -1}, buffer);
            buffer = null //remove buffer
            //console.log("fcs: ", fcs);
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
            
            // fcsArray
            fcsArray = fcs.dataAsNumbers; 
            fcs = null; //remove fcs
            //console.log("fcsArray: ", fcsArray);
            console.log("Column Names: ", fcsColumnNames);
            customLog("fcsArray: ", "finished.");
            customLog('Column Names:', fcsColumnNames);

            //check fcs size and do subset
            SubsetSize = parseInt(document.getElementById('subset-size').value, 10);
            let full_fcsArraylength = fcsArray.length
            if (full_fcsArraylength > SubsetSize){
                if (SubsetMethod == "random") {
                    fcsArray = generateSubset(fcsArray,SubsetSize)
                }else if (SubsetMethod == "peak_channel") {
                    let topN = SubsetSize
                    fcsArray = filterTopRows(fcsArray, fcsColumnNames, selectedSeusetChannelName,topN );
                }
                
                document.getElementById('file-reading-worrying1').innerText = 'Note: the fcs file has too many cells (' + full_fcsArraylength + '), only ' + SubsetSize + ' cells are imported';
                document.getElementById('file-reading-worrying2').innerText = 'Subset method: ' + SubsetMethod;
                document.getElementById('file-reading-worrying3').innerText = 'Subset size: ' + SubsetSize;
                customLog('Note: the fcs file has too many cells (' + full_fcsArraylength + '), only ' + SubsetSize + ' cells are imported');
                customLog('Subset method: ' + SubsetMethod);
                customLog('Subset size: ' + SubsetSize);
                if(SubsetMethod == "peak_channel"){
                    document.getElementById('file-reading-worrying4').innerText = 'Peak channel: ' + selectedSeusetChannelName;
                    customLog('Peak channel: ' + selectedSeusetChannelName);
                }
                
            } else {
                document.getElementById('file-reading-worrying1').innerText = 'Note: all cells (' + full_fcsArraylength + ') are imported';
                customLog('Note: all cells (' + full_fcsArraylength + ') are imported');
            }

            // check if all ChannelNames is in fcsColumnNames
            if (matrix_available) {
                // check if all ChannelNames is in fcsColumnNames
                const notInfcsColumnNames = ChannelNames.filter(channel => !fcsColumnNames.includes(channel));
                //reminder of check results
                if (notInfcsColumnNames.length > 0) {
                    document.getElementById('file-reading-worrying5').innerText =  `These following channels were not found in the fcs file: ${notInfcsColumnNames.join(', ')}. Please check before moving on.`;
                    customLog(`These following channels were not found in the fcs file: ${notInfcsColumnNames.join(', ')} Please check before moving on.`);
                    document.getElementById('file-reading-worrying6').innerText =  `Channels found in the fcs file: ${ChannelNames.join(', ')}`;
                    customLog(`Channels found in the fcs file: ${ChannelNames.join(', ')}`);
                } else {
                    document.getElementById('file-reading-worrying5').innerText =  'All channels in unmixing matrix are in the fcs file.';
                    customLog('All channels in unmixing matrix are in the fcs file.');
                }
            } 
            
            //Generate axis pulldown for plots
            populateColumnDropdowns('x-dropdown',fcsColumnNames);
            populateColumnDropdowns('y-dropdown',fcsColumnNames);

            peakChannel = FindPeakChannel(fcsArray, fcsColumnNames)
            //setDefaultDropdown("x-dropdown",peakChannel) // The peak channel is not reliable
            document.getElementById('plotset-size-input').value = SubsetSize//set default number

            document.getElementById('file-reading-reminder').innerText = 'Done reading the scc file!';
            //show scatter-plot-setup-div
            document.getElementById('scatter-plot-setup-div').style.display = 'block';
        };
        reader.readAsArrayBuffer(file);
    } else {
        console.error('No file selected');
        customLog('No file selected');
    }
}

function FindPeakChannel(fcsArray, fcsColumnNames) {
    const filteredColumnNames = fcsColumnNames.filter(name => {
        return name.endsWith('-A') && !name.includes('SSC') && !name.includes('FSC');
    });
    // calculte all median
    const medianValues = filteredColumnNames.map(columnName => {
        const columnIndex = fcsColumnNames.indexOf(columnName);
        const columnValues = fcsArray.map(row => row[columnIndex]);
        return {
            columnName: columnName,
            median: median(columnValues)
        };
    });

    // find the ColumnName of max medain
    const maxMedianValue = max(...medianValues.map(item => item.median));
    const peakChannel = medianValues.find(item => item.median === maxMedianValue).columnName;

    return peakChannel;
}

function filterTopRows(fcsArray, fcsColumnNames, channelName, topN) {
    const columnIndex = fcsColumnNames.indexOf(channelName);
    const columnValues = fcsArray.map(row => row[columnIndex]);

    const topIndices = columnValues
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topN)
        .map(item => item.index);

    const filteredRows = topIndices.map(index => fcsArray[index]);
    
    return filteredRows;
}

function populateColumnDropdowns(dropdownelement_id,options) {
    const Dropdown = document.getElementById(dropdownelement_id);
    Dropdown.innerHTML = '';

    options.forEach(name => {
        const Option = document.createElement('option');
        Option.textContent = name;
        Option.value = name;
        Dropdown.appendChild(Option);
    });
}

// Select x and y axes
document.getElementById('x-dropdown').addEventListener('change', function(event) {
    x_val = event.target.value;
    customLog('Selected x_val:', x_val);
});

document.getElementById('y-dropdown').addEventListener('change', function(event) {
    y_val = event.target.value;
    customLog('Selected y_val:', y_val);
});


// Create scatter plot

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

function generateSubset(fcsArrayInput,PlotCellSize){
    var Plotset
    if (fcsArrayInput.length > PlotCellSize) {
        Plotset = getRandomSubset(fcsArrayInput, PlotCellSize, 123);
    } else if (fcsArray.length == 0){
        console.error('fcsArrayInput is empty');
        customLog('fcsArrayInput is empty');
    } else {
        Plotset = fcsArrayInput
    }
    console.log('Subset Data:', Plotset); 
    customLog('Row number of Subset Data:', Plotset.length);
    customLog('Column number of Subset Data:', Plotset[0].length);
    return Plotset
}

function createPlotset(fcsArrayPlotset,x_val,y_val,fcsColumnNames,enable_density_plot) {
    const xIndex = fcsColumnNames.indexOf(x_val);
    const yIndex = fcsColumnNames.indexOf(y_val);
    if (xIndex === -1 || yIndex === -1) {
        console.error('Invalid column names');
        customLog('Invalid column names');
        return;
    }
    var xData = fcsArrayPlotset.map(row => row[xIndex]);
    var yData = fcsArrayPlotset.map(row => row[yIndex]);
    //scale
    xData = dotMultiply(sign(xData),log10(add(abs(xData),1)))
    yData = dotMultiply(sign(yData),log10(add(abs(yData),1)))

    if (enable_density_plot) {
        const data = [];
        for (let i = 0; i < xData.length; i++) {
            data.push([xData[i], yData[i]]);
        }
        const kde = new KernelDensityEstimator(data);
        const density = kde.estimateDensity();
    
        var trace = {
            x: xData,
            y: yData,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 6,
                color: density,
                colorscale: 'Viridis',
                showscale: true,
                colorbar: {
                    title: 'Density'
                }
            }
        };
    } else {
        var trace = {
            x: xData,
            y: yData,
            mode: 'markers',
            type: 'scatter'
            }
    }
    

    var layout = {
        title: {text: 'Scatter Plot (Raw)'},
        xaxis: { title: {text: x_val + " (log10)"}},
        yaxis: { title: {text: y_val + " (log10)"}},
        dragmode: 'select' // Enable selection mode
    };
    document.getElementById('plot-reminder').style.display = 'block';
    document.getElementById('plot-reminder').innerText = "Total cell counts: " + xData.length
    Plotly.newPlot('plot', [trace], layout);
    var selected_count = 0
    document.getElementById('selected-reminder').style.display = 'block';
    // Add event listener for selection
    const plotElement = document.getElementById('plot');
    plotElement.on('plotly_selected', function(eventData) {
        try{
            const selectedPoints_count = eventData.points.length
            const selectedPoints = eventData.points;
            const selectedIndices = selectedPoints.map(point => point.pointIndex);
            selectedSubset_fcsArray = selectedIndices.map(index => fcsArrayPlotset[index]);
            customLog('Row number of Selected Subset:', selectedSubset_fcsArray.length);
            customLog('Column number of Selected Subset:', selectedSubset_fcsArray[0].length);
            document.getElementById('selected-reminder').innerText = "Selected cell count: " + selectedPoints_count
        } catch (error) {
            document.getElementById('selected-reminder').innerText = "Selected cell count: 0";
        }
    });
}

class KernelDensityEstimator {
    constructor(data) {
        this.data = data;
    }

    estimateDensity() {
        const density = [];
        for (let i = 0; i < this.data.length; i++) {
            let sum = 0;
            for (let j = 0; j < this.data.length; j++) {
                sum += this.kernel(this.distance(this.data[i], this.data[j]));
            }
            density.push(sum / this.data.length);
        }
        return density;
    }

    kernel(distance) {
        return exp(-0.5 * distance * distance) / sqrt(2 * Math.PI);
    }

    distance(point1, point2) {
        return sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2);
    }
}

document.getElementById('plot-button').addEventListener('click', async () => {
    PlotCellSize = document.getElementById('plotset-size-input').value
    fcsArrayPlotset = generateSubset(fcsArray,PlotCellSize)
    x_val = document.getElementById('x-dropdown').value
    y_val = document.getElementById('y-dropdown').value
    createPlotset(fcsArrayPlotset,x_val,y_val,fcsColumnNames,enable_density_plot);
    // show step 3
    document.getElementById('set-population-div').style.display = 'block';
    if (matrix_available) {
        document.getElementById('multi-channels-div').style.display = 'none';
    } else {
        document.getElementById('multi-channels-div').style.display = 'block';
        if (!checkbox_generated_check){
            populateCheckboxes()
        }
    }

    document.getElementById('calculate-sig-div').style.display = 'block';
}); 

// Re-plot with selected population
document.getElementById('replot-button').addEventListener('click', async () => {
    x_val = document.getElementById('x-dropdown').value
    y_val = document.getElementById('y-dropdown').value
    createPlotset(selectedSubset_fcsArray,x_val,y_val,fcsColumnNames,enable_density_plot);
}); 


document.querySelectorAll('input[name="sig-method"]').forEach(radio => {
    radio.addEventListener('change', handleRadioChange);
});

function handleRadioChange(event) {
    selectedsigMethod = event.target.value;
    console.log('Selected Method:', selectedsigMethod);
    if (selectedsigMethod == "AF") {
        document.getElementById('set-negative-div').style.display = "none"
    }else if (selectedsigMethod == "PN") {
        document.getElementById('set-negative-div').style.display = "block"
    }
}


// set positive and negative population
document.getElementById('set-positive-button').addEventListener('click', async () => {
    try{
        positivefcsArray = selectedSubset_fcsArray
        customLog('Row number of positivefcsArray:', positivefcsArray.length);
        customLog('Column number of positivefcsArray:', positivefcsArray[0].length);
        document.getElementById('set-positive-reminder').innerText = "A total of " + positivefcsArray.length + " cells are set as positive population."
    } catch (error) {
        document.getElementById('set-positive-reminder').innerText = "No cells are set as shifted positive population. Try again!"
    }
}); 

document.getElementById('set-negative-button').addEventListener('click', async () => {
    try{
        negativefcsArray = selectedSubset_fcsArray
        customLog('Row number of negativefcsArray:', negativefcsArray.length);
        customLog('Column number of negativefcsArray:', negativefcsArray[0].length);
        document.getElementById('set-negative-reminder').innerText = "A total of " + negativefcsArray.length + " cells are set as negative population."
    } catch (error) {
        document.getElementById('set-negative-reminder').innerText = "No cells are set as negative population. Try again!"
    }
}); 

//document.getElementById('checkbox-container').addEventListener('change', handleCheckboxChange);

function populateCheckboxes() {
    const filteredColumnNames = fcsColumnNames.filter(name => {
        return name.endsWith('-A') && !name.includes('SSC') && !name.includes('FSC');
    });
    
    const container = document.getElementById('checkbox-container');
    fcsColumnNames.forEach(name => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;
        checkbox.id = name;
        checkbox.addEventListener('change', handleCheckboxChange);

        // check if filteredColumnNames 
        if (filteredColumnNames.includes(name)) {
            checkbox.checked = true;
        }
        

        const label = document.createElement('label');
        label.htmlFor = name;
        label.textContent = name;

        container.appendChild(checkbox);
        container.appendChild(label);
        container.appendChild(document.createElement('br'));
    });

    const checkboxes = document.querySelectorAll('#checkbox-container input[type="checkbox"]');
    let selectedSigChannels = [];
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedSigChannels.push(checkbox.value);
        }
    });
    ChannelNames = selectedSigChannels;
    checkbox_generated_check = true;
}

function handleCheckboxChange() {
    const checkboxes = document.querySelectorAll('#checkbox-container input[type="checkbox"]');

    let selectedSigChannels = [];

    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedSigChannels.push(checkbox.value);
        }
    });

    // set ChannelNames from Checkbox
    ChannelNames = selectedSigChannels

    document.getElementById('multi-channels-dropdown-reminder').innerText = "A total of " + ChannelNames.length + " channels were selected."
    customLog("A total of " + ChannelNames.length + " channels were selected.");
    customLog('Selected Sig Channels:', ChannelNames);
}



// Calculate signature

// Calcualte MedianSigCalculater
function MedianSigCalculater(PopulationfcsArray,fcsColumnNames,ChannelNames) {
    //filter populationfcsArray with ChannelNames
    const selectedIndices = ChannelNames.map(value => fcsColumnNames.indexOf(value)).filter(index => index !== -1);
    customLog('selectedIndices: ',selectedIndices);
    const filterArrayByIndices = (array, indices) => array.map(row => indices.map(index => row[index]));

    const filteredPopulationfcsArray = filterArrayByIndices(PopulationfcsArray, selectedIndices);
    customLog('Row number of filteredPopulationfcsArray:', filteredPopulationfcsArray.length);
    customLog('Column number of filteredPopulationfcsArray:', filteredPopulationfcsArray[0].length);
    
    //transform filteredPopulationfcsArray into matrix, which is PopulationB
    const PopulationB = transpose(matrix(filteredPopulationfcsArray));
    customLog('Row and column number of PopulationB:', PopulationB._size);

    //calculate Median_PopulationB with median operation
    const Median_PopulationB = PopulationB._data.map(row => median(row)); // Median along rows
    customLog('Median_PopulationB:', Median_PopulationB);

    return Median_PopulationB;
}

document.getElementById('calculation-button').addEventListener('click', async () => {
    if (selectedsigMethod == "PN") {
        //check positivefcsArray and negativefcsArray 
        if (positivefcsArray.length === 0 || negativefcsArray.length === 0) {
            document.getElementById('calculation-button-reminder').innerText = "Please select positive and negative populations first.";
        }else{
            // Proceed with calculation
            pos_sig = MedianSigCalculater(positivefcsArray,fcsColumnNames,ChannelNames)
            neg_sig = MedianSigCalculater(negativefcsArray,fcsColumnNames,ChannelNames)
            customLog('pos_sig: ',pos_sig);
            customLog('neg_sig: ',neg_sig);
            final_sig = subtract(pos_sig,neg_sig);
            customLog('final_sig: ',final_sig);
            //plot
            document.getElementById('plotly-linechart-pos').style.display = 'block';
            document.getElementById('plotly-linechart-neg').style.display = 'block';
            document.getElementById('plotly-linechart-final').style.display = 'block';
            PlotLineChart(pos_sig,ChannelNames,plot_title="Spectrum of positive populaiton",elementid="plotly-linechart-pos")
            PlotLineChart(neg_sig,ChannelNames,plot_title="Spectrum of negative populaiton",elementid="plotly-linechart-neg")
            PlotLineChart(final_sig,ChannelNames,plot_title="Spectrum of " + PrimaryName + "_" + SecondaryName,elementid="plotly-linechart-final")
        }
    } else if (selectedsigMethod == "AF"){
        //check positivefcsArray 
        if (positivefcsArray.length === 0 ) {
            document.getElementById('calculation-button-reminder').innerText = "Please select positive populations first.";
        }else{
            // Proceed with calculation
            pos_sig = MedianSigCalculater(positivefcsArray,fcsColumnNames,ChannelNames)
            
            customLog('pos_sig: ',pos_sig);

            final_sig = pos_sig
            customLog('final_sig: ',final_sig);
            //plot
            document.getElementById('plotly-linechart-pos').style.display = 'none';
            document.getElementById('plotly-linechart-neg').style.display = 'none';
            document.getElementById('plotly-linechart-final').style.display = 'block';

            PlotLineChart(final_sig,ChannelNames,plot_title="Spectrum of " + PrimaryName + "_" + SecondaryName,elementid="plotly-linechart-final")
        }
    }
    //show step 4
    document.getElementById('save-button-div').style.display = 'block';
}); 

// Plot line chart
function PlotLineChart(Sig,ChannelNames,plot_title,elementid) {
    // Plot the chart using Plotly
    const trace1 = {
        x: ChannelNames,
        y: Sig,
        mode: 'lines',
        line: { color: 'rgb(75, 122, 192)' }
    };

    const data = [trace1];

    const layout = {
        title: {text: plot_title},
        xaxis: { title: {pad: { t: 50 }} },
        yaxis: { title: {text: 'Signal'}  },
        margin: { b: 100 } 
    };

    Plotly.newPlot(elementid, data, layout);
}


function normalizeToValue(sig, value) {
    const maxVal = max(...sig);
    return sig.map(num => (num / maxVal) * value);
}


document.getElementById('save-button').addEventListener('click', () => {
    //normaliza final_sig
    const normalizationValue = document.getElementById('normalization-dropdown').value;
    customLog('normalizationValue: ',normalizationValue);
    if (normalizationValue === '1') {
        final_sig = normalizeToValue(final_sig, 1);
    } else if (normalizationValue === '100') {
        final_sig = normalizeToValue(final_sig, 100);
    } else {
        // no normalization
        console.log('No normalization applied.');
    }
    customLog('Normalized final_sig: ',final_sig);
    let csvData
    if (matrix_available) {
        // Convert array to CSV format
        const csvHeader = ['Primary', 'Secondary', ...ChannelNames].join(',');
        let twoDimArray = csvArray.map(obj => Object.values(obj));
        const csvContent = twoDimArray.map(row => row.join(',')).join('\n');
        //add PrimaryName, SecondaryName, and the final_sig 1d array to csvContent as a new row
        const newRow = [PrimaryName, SecondaryName, ...final_sig].join(',');
        const updatedCsvContent = `${csvContent}\n${newRow}`;
        // make csvData
        csvData = `${csvHeader}\n${updatedCsvContent}`;
    }else{
        // Convert array to CSV format
        const csvHeader = ['Primary', 'Secondary', ...ChannelNames].join(',');
        //use PrimaryName, SecondaryName, and the final_sig 1d array to make the csvContent
        const newRow = [PrimaryName, SecondaryName, ...final_sig].join(',');
        // make csvData
        csvData = `${csvHeader}\n${newRow}`;       
    }
    customLog('csvData: ',csvData);

    // Create a blob from the CSV content
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

    // Create a link element
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'unmixing_mtx_with_new_sig.csv';

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