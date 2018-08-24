on('chat:message',function(msg)
{
    //parse the message type
    if(msg.type != 'api')
    	return;
    
    var parts = msg.content.toLowerCase().split(' ');
    log( 'parts: '+parts);
    var command = parts.shift().substring(1); //remove the !
    
    if(command == 'exportattrs')
    { 
    	var name = "";
    	var output = "";
    	var who = "M";
    	
		//loop through the remaining parts for flags and other mods
        _.each(parts,function(curPart)
		{
            switch (curPart)
            {
            	default :
            		if (curPart.includes(":"))
                   	{
                       	curPartVal = curPart.split(":");
                       	
                       	switch(curPartVal[0])
                       	{                        			
                       		case "name":
                       			name = curPartVal[1];
                       			break;
                       	}
                   	}
            }
        });
                
        var characters = findObjs({_type: 'character'});
        var character;
        characters.forEach(function(chr)
		{
        	if(chr.get('name').toLowerCase() == name)
        		character = chr;
    	});
        
        var attrs = getAttrByName(character.id, "export_text");
        
        output += "{\\n    attrs: " + attrs; 
        
        output += ',\\n    character: {';
		output += "avatar: '" + character.get('avatar') + "'";
		
		character.get('bio', function(bio)
		{
			output += ", bio: '" + bio.replace(/'/g, "\\'").replace(/(<[^<>]*>)/g, " ") + "'";
			
			character.get('gmnotes', function(gmNotes)
			{
				output += ", gmnotes: '" + gmNotes.replace(/'/g, "\\'").replace(/(<[^<>]*>)/g, " ") + "'}";
				
				character.get('defaulttoken', function(tokenJSON)
				{
					token = JSON.parse(tokenJSON);
					if (token == null)
						token = {imgsrc: "", width: 70, height: 70};
					output += ",\\n    token: {imgsrc: '" + token.imgsrc + "'";
					output += ", width: " + token.width + ", height:" + token.height + ", layer: 'objects'}";
				});
			});
		});

		output += '\\n';
		output = output
						.replace(/\|/g, "\\|")
						.replace(/\#/g, "\\#")
						.replace(/@({[^@]*})/g, "\\at$1")
						;
		
		
		log("output is : " + output);
        sendChat(who, "!setattr --replace --name " + character.get('name') + " --export_text|"+output+"}");
    }
});