/** Evaluate a mathematical expression.
 * 
 * Beware ! eval() function used  
 * 
 * @param exprStr 	: String, the expression to evaluate
 * 
 * @returns Number, the result of expression
 */
function evaluateExpr(exprStr)
{
	log("expr : " + exprStr);
	expr = exprStr
			.replace(/abs/g,"Math.abs")
			.replace(/floor/g,"Math.floor")
			.replace(/ceil/g,"Math.ceil")
			.replace(/round/g,"Math.round"); // in the sheet, the Math. prefix is not needed but for eval() function it's
	log("fix expr : " + expr);
	result = eval(expr);
	log("result: " + result);
	return result;
}

/** Roll 1d10 with the Anima Characteristic's system (V1 or V2).
 * 
 * @param charVal 		: Number, the value of Characteristic
 * @param testCharV1	: Boolean, true if you want use the V1 of system (a dice below characteristic) or false for the V2 (a dice + characteristic)
 * @param mod 			: Number, a modifier to characteristic
 * 
 * @returns String, the output to sendChat
 */
function testCharacteristic(charVal, testCharV1, mod)
{
	var outputChar = "";
	log ("characteristic test : " + charVal);
	dice = randomInteger(10); 		// Roll 1d10.
	log('Dice roll : '+dice);
	
	total = charVal + mod;
	
	if (testCharV1) // V1 system : a dice below characteristic
	{
		log("V1");
		outputChar += ' {{roll=<span style="font-family: \'dicefontd10\'">T</span><span style="font-weight:bold; font-size:1.2em;">'+dice+'</span>}} {{diff=<span style="font-weight:bold; font-size:1.2em;">' +total+ '</span><span style="font-size:0.8em;"> (<span style="font-family: \'Pictos\'">U</span>' +charVal+ ' + <span style="font-family: \'Pictos\'">+</span>' +mod+ ')</span>}}';
		
		total -= dice; // total - dice give the result range
		
		// check if roll a critical success or a fumble
		if (dice == 1) // roll a 1 it's a critical success : add 3 to result range
		{
			log("Critical Success!");
			total += 3;
			outputChar += ' {{critical=+3}}';
		} else if (dice == 10) // roll a 10 it's a fumble : remove 3 to result range
		{
			log("Fumble!");
			total += -3;
			outputChar += ' {{fumble=-3}}';
		}

		//  a negative number is a fail, a positive number a success
		if (total < 0)
			outputChar += " {{fail="+total+"}}";
		else
			outputChar += " {{sucess="+total+"}}";
		
	}
	else // V2 system : a dice + characteristic
	{
		log("V2");
		
		total += dice; // add dice to characteristic
		
		// check if roll a critical success or a fumble
		// the values are reverse related to V1 system
		if (dice == 1) // Fumble ! Remove 2 to result
		{
			log("Fumble!");
			total += -2;
			outputChar += ' {{fumble=-2}}';
		} else if (dice == 10) // Critical ! Add 2 to result
		{
			log("Critical Success!");
			total += 2;
			outputChar += ' {{critical=+2}}';
		}
		
		outputChar += ' {{roll=<span style="font-weight:bold; font-size:1.2em;">'+total+'</span> <span style="font-size:0.8em;">(<span style="font-family: \'dicefontd10\'">T</span>'+dice+' + <span style="font-family: \'Pictos\'">U</span>'+charVal+' + <span style="font-family: \'Pictos\'">+</span>'+mod+')</span>}}';
	}
	
	return outputChar;
}

/** Roll a 1d100 with the Anima's system :
 * 
 * open roll if dice > 90 the first time, then 91 ... until 100
 * capped the dice if exceed the inhumanity or zen ability.
 * roll a fumble if dice is < 3 (5 if it's complex, but decrease by 1 with the mastery)
 * ...

 * 
 * @param fumbleCeil 	: Number, 3 by default, to modify if complex or mastery.
 * @param openFloor 	: array ([90, [<extraVal1>,<extraVal2>,...]]), the first value is the "classic" floor (90),
 *  				  	  the second value is an array containing the extra values causing a open roll like double values (11, 22, 33...)
 * @param mod 			: Number, the modifier on dice
 * @param close 		: Boolean, prevent open roll and fumble if true
 * @param initiative	: Boolean, use initiative modifier in case of fumble. Close dice
 * @param inhumanity 	: Boolean, capped dice to 319 if false, 439 if true
 * @param zen 			: Boolean, not capped dice if true
 * 
 * @returns
 * 	[
 *   	"output": String, The output to sendChat,
 *   	"res": Number, the dice result,
 *   	"fumble": True if fumble has obtained,
 *   	"fumbleLevel": Number, the fumble level where appropriate
 *  ]
 */
function openRoll(fumbleCeil, openFloor, val, mod, close, initiative, inhumanity, zen)
{
	var outputRoll = "";
	var open;				// Flag for the player having rolled a number above openFloor.
	var dice;				// Numberical value of latest dice rolled (1d100). Good for debugging/transparency.
	var rollCount=1;		// Number of times dice have been rolled. Good for debugging and fumble validation.
	var rollTracking=''; 	// Track rolls in string form for logs / output.
	var capped = false;     // Flag to display to the player when their roll is limited.
	var fumble = false;
	var fumbleLevel = false;
	var total = mod + val;
	
	log('Openroll Floor: '+openFloor);
    log('Fumble Ceiling: '+fumbleCeil);
	
	do
	{
        open=false; 					
        
    	dice = randomInteger(100); 		// Roll 1d100.            
        log('Dice roll ' +rollCount + ': '+dice);
		
        
        if(dice <= fumbleCeil && rollCount==1)
        {
			// if dice result was < fumbleCeil, a fumble has occured.
			// NOTE: fumbles cannot happen after an open roll occurs, hence the check on rollCount.
        	fumble = true;
			fumbleMod = 0;
			fumbleDice = 0;

			if (initiative)
			{
				fumbleModArray = [-125, -100, -75];
				
				fumbleLevel = fumbleModArray[dice-1];
				
			} else if (close)
				fumbleLevel=dice;
			else
			{
				fumbleModArray = [-15, 0, 15, 15, 15];
				fumbleModArrayMastery = [0, 15];
				
				if (fumbleCeil == 2)
					fumbleMod = fumbleModArrayMastery[dice-1];
				else
					fumbleMod = fumbleModArray[dice-1];
				
				fumbleDice=randomInteger(100);
				fumbleLevel= fumbleMod - fumbleDice;
				log('Fumble Level: '+fumbleLevel);
				outputRoll += ' {{fumble='+fumbleLevel+'}}';

				if (fumbleLevel <= -80)
					outputRoll += ' {{fumbleCritical=1}}';
				
			}

			total += fumbleLevel;
			rollTracking += '('+fumbleLevel+')+';

        } else
    	{
            //check if dice result was > openFloor, if so, will roll again.
            if( !close && (dice >= openFloor[0] || openFloor[1].includes(dice)))
            {

            	if(openFloor[0] <100)
            		openFloor[0]++; 						// Increment openFloor, can never exceed 100.
            	
                rollTracking += '<a style="color:Green"><b>'+dice+'</b></a>+';	// Add dice roll to string for output later.
                open=true;
				rollCount++;

            } else
                rollTracking += dice+'+';
        
            total += dice;	//record the total so far.
    	}
	} while(open); 		//roll again if openroll occured.
		

    //take off the last + in the rollTracking string so the output doesn't look stupid.
	rollTracking = rollTracking.substring(0,(rollTracking.length)-1);
	
	
    //apply any and all limitations.
    if(inhumanity && !zen)//only one can apply, as zen overwrites inhumanity.
    {
        if(total>439)
        {
            capped = true;  // the player was limited.
            dice = total;   //reuse variable, save original (uncapped) roll.
            total = 439; 	//zen starts at 440.
        }
    } else if(!zen)
    {
        if(total > 319)
        {
            capped = true;  // the player was limited.
            dice = total;   // reuse variable, save original (uncapped) roll.
            total = 319;	// standard roll, limit below inhumanity (320).
        }
    } //no else case for if(zen), as all rolls above 440 are allowed if the roll has zen.
	
    if(capped)
    	outputRoll += ' {{capped='+dice+'}}';
    

    outputRoll += ' {{roll=<span style="font-weight:bold; font-size:1.2em;">'+total+'</span><span style="font-size:0.8em;"> (<span style="font-family: \'dicefontd10\'">T</span>'+rollTracking+' + <span style="font-family: \'Pictos\'">U</span>'+val+' + <span style="font-family: \'Pictos\'">+</span>' +mod+')</span>}}';
	
	return {'output' : outputRoll, 'res' : total, 'fumble' : fumble, 'fumbleLevel' : fumbleLevel};
}

/** calculate the result of an attack
 * 
 * @param diceResult	: array, the output of openRoll function
 * @param baseDmg 		: Number, the base of weapon's damage
 * @param def 			: Number, the defense result
 * @param armor 		: Number, the value of armor degree
 * 
 * @returns String, the output to sendChat
 */
function attackRes(diceResult, baseDmg, def, armor, criticalHitOptions)
{
	var outputAttack = " {{diff=" + def + " Armor " + armor + "}}";
	
    var att = diceResult["res"]; // get the res of attack
	var range = att - def; // calculate the range of attack
	// range of attack can be cut in level : between 0 and 9 it's the same result, idem between 10 and 19, etc until 400. And too for negatives values.
	// each level have a step of 10 -> calculate a index of each level.
    var rangeIndex = parseInt(range / 10);
    
	// for the range result between 0 and 100, the result is not linear
    // the follow array contains the % of damage by level (0 to 10) and by armor degree
	var dmgArray = [
	    [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	    [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	    [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	    [ 10,10,10, 0, 0, 0, 0, 0, 0, 0, 0],
	    [ 30,20,20,10, 0, 0, 0, 0, 0, 0, 0],
	    [ 50,40,30,20,10, 0, 0, 0, 0, 0, 0],
	    [ 60,50,40,30,20,10, 0, 0, 0, 0, 0],
	    [ 70,60,50,40,30,20,10, 0, 0, 0, 0],
	    [ 80,70,60,50,40,30,20,10, 0, 0, 0],
	    [ 90,80,70,60,50,40,30,20,10, 0, 0],
	    [100,90,80,70,60,50,40,30,20,10, 0]
    ];
    
    
    var res = 0;
    if (range < 0)
    {
        // Fail
        if (range <= -300) 
            res = 150;
        else    
            res = rangeIndex * -5; // the bonus to counter attack increase by 5 foreach level : +0 for level 0 (range between -1 and -9), +5 for next level...
        
        outputAttack += ' {{fail=+' + res + 'C (range : ' + range + ')}}';
        
    } else
    {
        // Success
        if (range >= 400)
            res = 400 - armor*10; // maximum damage - armor (10% / armor degree)
        
        else
        {
            if (rangeIndex <= 10) // below this level, the progression isn't linear -> use the array
                res = dmgArray[rangeIndex][armor];
            
            else // level*10 = the % of range
                res = rangeIndex*10 - armor*10;
        }
        
        // the damage is the range % of baseDmg
        var dmg = baseDmg / 100 * res;
        
        outputAttack += ' {{sucess=Damage : ' + dmg + ' (range : ' + range + ')}} {{criticalhit=[Critical Hit ?](!openroll criticalhit,100,&#63;{Locate|true|false},&#63;{Resistance|0} &#63;{Modifier|0} '+criticalHitOptions+')}}';
    }
    
    return outputAttack;
}

/** Function to calculate critical hit result
 * 
 * @param resistance	: Number, value of physical resistance
 * @param dmg 			: Number, the damage inflicted
 * @param mod 			: Number, the modifier to critical level
 * @param locate 		: Boolean, true if hit wasn't locate (launch 1d100 to locate if critical range > -50)
 * 
 * @returns String, the output to sendChat
 */
function criticalHit(resistance, dmg, mod, locate)
{
	var outputCriticalHit = "";
	var locationStr = "";
	
	var locationTable = 
		[
			[ 1, 10, "cote"],
			[11, 20, "epaule"],
			[21, 30, "estomac"],
			[31, 35, "reins"],
			[36, 48, "torse"],
			[49, 50, "coeur"],
			[51, 54, "bras droit"],
			[55, 58, "avant-bras droit"],
			[59, 60, "main droite"],
			[61, 64, "bras gauche"],
			[65, 68, "avant-bras gauche"],
			[69, 70, "main gauche"],
			[71, 74, "cuisse droite"],
			[75, 78, "tibia droit"],
			[79, 80, "pied droit"],
			[81, 85, "cuisse gauche"],
			[86, 88, "tibia gauche"],
			[89, 90, "pied gauche"],
			[91, 100, "tete"]
		]
	
	dice=randomInteger(100);
	criticalLevel = dice + dmg + mod;
	
	// excess points 200 are /2.
	if (criticalLevel > 200)
		criticalLevel -= (criticalLevel-200)/2;
	
	
	criticalRange = resistance - criticalLevel;
	
	if (criticalRange >= 0) // Sucess
	
		outputCriticalHit += "{{resists=true}}";
	
	else // fail
	{
		// 0 > range > -50
		outputCriticalHit += "{{criticalhit=Malus : " + criticalRange + "}}";
		
		if (criticalRange < -50) // -50 > range > -100 
		{
			// locate the hit, if it wasn't yet
			if (locate)
			{
				location = randomInteger(100);
				
				for (i=0; i<locationTable.length; i++)
				{
					if (location >= locationTable[i][0] && location <= locationTable[i][1])
						locationStr = locationTable[i][2]
				}
			}
			
			outputCriticalHit += " {{range-50=true}} {{location=" + locationStr + "}}";
		}
		
		if (criticalRange < -100) // -100 > range > -150 
		
			outputCriticalHit += " {{range-100=true}}";
		
		if (criticalRange < -150) // -150 > range
		
			outputCriticalHit += " {{range-150=true}}";
	}
	
	return outputCriticalHit;
}

/** Script for manage Anima Beyond Fantasy system
 * 
 * use : !openroll <mod1> <mod2> <mod3> ...
 * By default the script roll 1d100 with the mecanism of Anima's open roll : (90, 91, 92...)
 * Modifiers, separate by blank space can be applied. The possible values is :
 * 
 * who:<string> -> the String used for sendChat function as SpeakingAs parameter. If not set, the script use msg.playerid of the 'chat:message' event
 * 
 * <number> -> a number like 50 or 90. Several number are add between them. For sample : !openroll 50 90 -> roll 1d100+140
 * 
 * inhumanity | inhuman -> the total is capped to 439 (319 else).
 * 
 * zen -> the total isn't capped.
 * 
 * initiative -> Roll a dice with the correct modifiers for initiative (ie : not open roll and [-125, -100, -75] modifiers in case of fumble [1, 2, 3]) 
 * 
 * close -> roll a not open dice and not fumble (ie : resistance dice)
 * 
 * complex -> increase the fumble range to +2
 * 
 * mastery -> decrease the fumble range to -1
 * 
 * expr:<mathExpr> -> allow to realize mathematical expression. For sample : !openroll expr:1*15 -> roll 1d100+1*15. Beware with this modifiers ! eval() function used...
 * 
 * name:<name> -> Display the name in template
 * 
 * val:<number>|expr:<mathExpr> -> the competence/characteristics value (only for display)
 * 
 * characteristics:v<1|2>:<charVal>|expr:<mathExpr> -> roll a V1 or V2 characteristics test.
 * 		Possible usage : !openroll characteristics:v1:7 ; !openroll characteristics:v1:expr:5+2
 * 	param v<1|2>						: v1|v2, the system version. v1 : char's val - 1d10; v2 1d10 + char's val.
 * 	param <charVal>	| expr:<mathExpr>	: Number or String, the characteristics' value. A mathematical expression is possible
 * 
 * attack:<baseDmg>:<defVal>:<armor> -> Calculate the result of an attack.
 * 	param <baseDmg>	: Number, the base of weapon damage
 * 	param <defVal>	: Number, the Defense value of target
 * 	param <armor>	: Number, the armor of target.
 * 
 * gm -> roll in secret
 * 
 * cs:<val> -> add a extra value to openFloor. For example "cs:11 cs:22 cs:33 cs:44 cs:55 cs:66 cs:77 cs:88 cs:99" add the doubles values to openFloor
 * 	param <val>	: Number, the extra value to add to openFloor.
 * 
 * criticalhit,<dmg>,<locate>,<resistance> -> calculate the critical hit result.
 * 	param <dmg> 		: Number, the damage inflicted
 * 	param <locate> 		: Boolean, true if the hit wasn't locate
 * 	param <resistance>	: Number, the resistance of target
 * 
 * @param msg : String, the "!openroll <mod1> <mod2> <mod3> ..." command
 * 
 * @returns Nothing, send a msg to chat box
 */
on('chat:message',function(msg)
{
	    
    //parse the message type
    if(msg.type != 'api')
    	return;
    
    var parts = msg.content.toLowerCase().split(' ');
    log( 'parts: '+parts);
    var command = parts.shift().substring(1); //remove the !
    
    if(command == 'openroll')
    {    //Variable Declarations
    	var who = "";
    	var diceRes;
		var openFloor = [90, []]; 	// The minimum result needed to roll again. set to the default described in the core rules.
		var fumbleCeil = 3; 	// Rolls below or equal to this number are considered fumbles. set to core rules default.
		var close = false;		// Flag to set dice to closed.
        var mod = 0;            // Variable to keep track of mod throughout number calculations.
        var inhumanity = false;	// Limit rolls below 320 unless this is true.
        var zen = false;		// Limit rolls below 440 unless this is true.
		var initiative = false; // Flag to set the result after flag calculation to the initiative table.
        var capped = false;     // Flag to display to the player when their roll is limited.
        var expr = "";
        var output = "";
        
        var val = 0;
        
        var testChar = false;
        var testCharV1 = false;
        var testCharV2 = false;
        
        var attack = false;
        var baseDmg = 0;
        var defVal = 0;
        var armor = 0;
        var criticalHitOptions = "";
        
        var cmdMsg = "/direct ";
        
        var criticalhit = false;
        var dmg = 0;
        var locate = true;
        var resistance = 0;
		
		//loop through the remaining parts for flags and other mods
        _.each(parts,function(curPart)
		{
            if(!isNaN(Number(curPart)))
            	//add numbers to mod
                mod+= Number(curPart);
            
            else if (curPart.startsWith('{'))
            	output += " " + curPart;
            else {
            	switch (curPart)
            	{
            		case "gm" :
            			cmdMsg = "/w gm ";
            			criticalHitOptions = "gm ";
            			break;
            		
	            	case "inhumanity" :
	            	case "inhuman" :
	            		inhumanity = true;
	            		break;
            		
	            	case "zen" :
	            		zen = true;
	            		break;
	            		
	            	case "initiative":
	            		initiative = true;
	                    close = true;
	                    break;
	                    
	            	case "close":
	            		close = true;
	            		break;
	            		
	            	case "complex" :
	            		if(!initiative)
	                		// complex doesn't apply to initiative rolls.
	                    	fumbleCeil+=2;
	            		break;
	            		
	            	case "mastery" :
	            		if(!initiative)
	                		//mastery doesn't apply to initiative rolls.
	                    	fumbleCeil--;
	            		break;
	            		
            		default :
            			if (curPart.includes(":"))
                    	{
                        	curPartVal = curPart.split(":");
                        	
                        	switch(curPartVal[0])
                        	{                        			
                        		case "cs":
                        			openFloor[1].push(Number(curPartVal[1]));
                        			break;
                        			
                        		case "who":
                        			who = curPartVal[1];
                        			break;
                        		
                    			case "template":
                    				output = "&{template:ABF" + curPartVal[1] + "}";
                    				break;
                    				
                        		case "expr":
                        			mod += evaluateExpr(curPartVal[1]);
                        			break;
                        			
                        		case 'val':
                        			if (curPartVal[1] == "expr")
                            		{
                                		log ("expr");
                                		val = evaluateExpr(curPartVal[2]);
                            		}
                                	else
                            		{
                                		log("number " + curPartVal[1]);
                                		val = Number(curPartVal[1]);
                            		}
                        			
                        			break;
                        			
                        		case "characteristics":
                        			testChar = true;
                                	log ("test char");
                                	
                                	if (curPartVal[1] == "v1")
                            		{
                                		log ("v1");
                                		testCharV1 = true;
                            		}
                            		else
                        			{
                            			log ("v2");
                            			testCharV2 = true;
                        			}
                                	
                                	break;
                                	
                        		case "attack":
                        			attack = true;
        	                    	
                                	baseDmg = evaluateExpr(curPartVal[1]);
                                	defVal = curPartVal[2];
                                	armor = curPartVal[3];
                                	
                                	break;
                        	}
                    	} else if (curPart.includes(","))
                    	{
                        	curPartVal = curPart.split(",");
                        	
                        	switch(curPartVal[0])
                        	{
                        		case "criticalhit":
                        			criticalhit = true;
                        			output = "&{template:ABFcriticalhit}";
                        			
                                	dmg = Number(curPartVal[1]);
                                	locate = (curPartVal[2] == 'true');;
                                	resistance = Number(curPartVal[3]);
                                	
                        			break;
                        	}
                    	}
            	}
            }
        });
        
        
        if (who == "")
        	who = 'player|'+msg.playerid;
        else
        	criticalHitOptions += "who:"+who;
        
        if (testChar)
        	output += testCharacteristic(val, testCharV1, mod);
        
        else if (criticalhit)
        	output += criticalHit(resistance, dmg, mod, locate);
        	
    	else
		{
    		diceRes = openRoll(fumbleCeil, openFloor, val, mod, close, initiative, inhumanity, zen);
    		output += diceRes["output"];
		
	        if (attack)
	        	output += attackRes(diceRes, baseDmg, defVal, armor, criticalHitOptions);
		}
        

   
        log("output is : " + output);
        sendChat(who, cmdMsg + output);
    }
});