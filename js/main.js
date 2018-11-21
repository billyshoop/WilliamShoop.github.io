/* Authored by Bill Shoop, 2018 */
//wrap everything in a self-executing anonymous function
(function(){
    
    //pseudo-global variables
    //variables for data join
    var attrArray = ["Labor Force","Employed","Unemployed","Unemployed Rate","Population"]; //list of attributes
    var expressed = attrArray[0]; //initial attributes
    
    //chart frame dimensions
    var chartWidth = window.innerWidth*0.425,
        chartHeight = 473,
        leftPadding = 38,
        rightPadding =2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([463,0])
        .domain([0,200000]);
    
//begin script when window loads    
    window.onload = setMap();
    
//set up choropleth map 
    function setMap(){
        
        //map frame dimensions
        var width = window.innerWidth*0.5,
            height = 460;
        
        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class","map")
            .attr("width",width)
            .attr("height",height);
        
        //create Albers equal area conic projection centered on Maine
        var projection = d3.geoAlbers()
            .center([0,45.2538])
            .rotate([69.4,0,0])
            .parallels([17,45])
            .scale(4000)
            .translate([width / 2, height /2]);
    
        var path = d3.geoPath()
            .projection(projection) 
        
        //use queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/2015MaineCtyEmploymentRates.csv")// load attributes from csv
            .defer(d3.json, "data/MaineBoundariesReproject.topojson")//load choropleth spatial data
            .defer(d3.json, "data/usStates.topojson")//load background spatial data
            .await(callback);
        
        function callback(error, csvData, maine, us){

            //place graticule on the map
            setGraticule(map,path);

            //translate maine and us states TopoJSONs
            var maineCounties = topojson.feature(maine, maine.objects.MaineBoundariesReproject).features;
            var usstates = topojson.feature(us, us.objects.usStates);
            //add us states to map
            var states = map.append("path")
                .datum(usstates)
                .attr("class","state")
                .attr("d", path);
            
            //join csv data to GeoJSON enumeration units
            maineCounties = joinData(maineCounties, csvData);
        
            //create the color scale
            var colorScale = makeColorScale(csvData);
        
            //add enumeration units to the map
            setEnumerationUnits(maineCounties, map, path, colorScale);
            
            //add coordinated visualization to the map
            setChart(csvData, colorScale);
            
            //add dropdown
            createDropdown(csvData, colorScale);
                
        };
    };//end of setMap()
    
    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
        
        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
        
        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        //set bars for each county
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a,b){
                return b[expressed]-a[expressed]
            })
            .attr("class",function(d){
                return "bar "+ d.COUNTY;
            })
            .attr("width", chartInnerWidth/csvData.length - 1)
            //bara event listener
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);
        
        //add style descriptor to each rect
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');
        
        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x",55)
            .attr("y",40)
            .attr("class","chartTitle")
            .text("Number of "+ expressed + " per County ");
        
        //create vertical axis generator
        var yAxis = d3.axisLeft(yScale)
            .scale(yScale);
        
        //place axis
        var axis = chart.append("g")
            .attr("class","axis")
            .attr("transform", translate)
            .call(yAxis);
        
        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);
    };
    
    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData, colorScale){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class","dropdown")
            .on("change",function(){
                changeAttribute(this.value, csvData)
            });
        
        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class","titleOption")
            .attr("disabled","true")
            .text("Select Attribute");
        
        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){
                return d 
            })
            .text(function(d){
                return d
            });
        
        //dropdown change listener handler
        function changeAttribute(attribute, csvData){
            //change the expressed attribute
            expressed = attribute;
            
            if (expressed == attrArray[2]){
                yScale = d3.scaleLinear()
                    .range([463,0])
                    .domain([0,5500]);
            } else if(expressed == attrArray[3]){
                yScale = d3.scaleLinear()
                    .range([463,0])
                    .domain([0,8]);
            } else if(expressed == attrArray[4]){
                yScale = d3.scaleLinear()
                    .range([463,0])
                    .domain([0,325000]);
            } else{
                yScale = d3.scaleLinear()
                    .range([463,0])
                    .domain([0,200000]);
            }
            
            //recreate the color scale
            var colorScale = makeColorScale(csvData);
            
            //recolor enumeration units
            var regions = d3.selectAll(".regions")
                .transition()//add animation
                .duration(1000)
                .style("fill", function(d){
                    return choropleth(d.properties, colorScale)
                });
            //resort, resize and recolor bars
            var bars = d3.selectAll(".bar")
                //resort bars
                .sort(function(a,b){
                    return b[expressed] - a[expressed];
                })
                .transition()// add animation
                .delay(function(d,i){
                    return i*20
                })
                .duration(500);
                
            updateChart(bars,csvData.length, colorScale);
        };
    };
    
    function updateChart(bars, n, colorScale){
            //position bars
            bars.attr("x", function(d,i){
                return i * (chartInnerWidth/n)+leftPadding;
            })
            //size/resize bars
            .attr("height", function(d,i){
                return 463- yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d,i){
                return yScale(parseFloat(d[expressed]))+topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
            var chartTitle = d3.select(".chartTitle")
                .text("Number of " + expressed + " in each County");
            var yAxis = d3.axisLeft()
                .scale(yScale)
        
            d3.selectAll("g.axis")
                .call(yAxis);
        };
    
    function setGraticule(map,path){
    
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5,5]);//place graticule lines every 5 degrees of long and lat
        
        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline())//bind graticule background
            .attr("class","gratBackground")//assign class for styling
            .attr("d",path)//project graticule
        
        //create graticule lines
        var gratLines = map.selectAll(".gratLines")//select graticule elements that will be created
            .data(graticule.lines())//bind graticule lines to each element to be created
            .enter()// create an elememt for each datum
            .append("path")//append each element to the svg as a path element
            .attr("class","gratLines")//assign class for styling
            .attr("d",path);//project grat lines

    };
    
    function joinData(maineCounties, csvData){
        
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvCounty = csvData[i]; //the current region
            var csvKey = csvCounty.COUNTY; //the CSV primary key
            
            //loop through geojson regions to find correct region
            for (var a=0; a<maineCounties.length; a++){
                
                var geojsonProps = maineCounties[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.COUNTY; //the geojson primary key
                
                //where primary keys match, transfer csv data to geojson proprties object
                if (geojsonKey == csvKey){
                    
                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvCounty[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties 
                    })
                }
            }
        }
       return maineCounties;
    };
    
    function setEnumerationUnits(maineCounties, map, path, colorScale){
        
        //add maine counties to map
        var regions = map.selectAll(".regions")
            .data(maineCounties)
            .enter()
            .append("path")
            .attr("class",function(d){
                return "regions " + d.properties.COUNTY;
            })
            .attr("d",path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            })
            //regions event listener
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
        
        //add style descriptor to each path
        var desc = regions.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };
    
    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses =[
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043"
        ];
        
        //create color scale generator
        var colorScale = d3.scaleQuantile()
            .range(colorClasses);
        
        //build array of all values of the expressed attributes 
        var domainArray=[];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };
        
        //assign array of expressed values as scale domain
        colorScale.domain(domainArray);
        
        return colorScale;
    };
    
    //function to test for data value and return color
    function choropleth(props,colorScale){
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CFD";
        };
    };
    
    //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("."+props.COUNTY)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        
        //call setLabel function
        setLabel(props);
    };
    
    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("."+props.COUNTY)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });
        
        function getStyle(element, styleName){
            var styleText =d3.select(element)
                .select("desc")
                .text();
            var styleObject = JSON.parse(styleText);
            
            return styleObject[styleName];
        };
        d3.select(".infolabel")
                .remove();
    };
    
    
    //function to create dynamic label
    function setLabel(props){
        //label content
        var labelAttribute = "<h1>" + props.COUNTY+"</h1><br>"+ expressed+ ": "+props[expressed];
        
        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id",props.COUNTY + "_label")
            .html(labelAttribute);
        
        var regionName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.name);
    };
    
    //function to move label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;
        
        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;
        
        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX>window.innerWidth - labelWidth -20 ? x2:x1;
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1;
        
        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };
})();