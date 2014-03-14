/** @const */ var global					= window;	// the "global" frame
/** @const */ var maxDeferredDOMInsertions	= 20;

////////////////////////////////////////////////////////////////////////////////
//						 ____        _     _ _
//						|  _ \ _   _| |__ | (_) ___
//						| |_) | | | | '_ \| | |/ __|
//						|  __/| |_| | |_) | | | (__
//						|_|    \__,_|_.__/|_|_|\___|
//
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Invocation style:	parent.instantiate(template, collection, ...);
/**@param {!Node}			template		The template to instantiate.
 * @param {!Array|!Object}	collection		The collection to iterate over.
 * @param {?Array.<Frame>=}	context			The PARENT context to resolve references in.  Top-level invocations can/should leave this null or un-specified.
 * @return {Array.<Node>}					An array of views of collection items.
 */
HTMLElement.prototype["instantiate"] = function(template, collection, context) {
	var instances = instantiateTemplate(template, collection, context, this);
	invokeLoadHandlers(instances);
	return instances;
};

////////////////////////////////////////////////////////////////////////////////
// Invocation style:	var i = new TemplateInstances(template, collection, ...);
/**@param {!Node}			template		The template to instantiate.
 * @param {!Array|!Object}	collection		The collection to iterate over.
 * @param {?Array.<Frame>}	context			The PARENT context to resolve references in.  Top-level invocations can/should leave this null or un-specified.
 * @param {!Node}			parentView		The view to append template instances (views) to.
 * @return {Array.<Node>}					An array of views of collection items.
 */
function TemplateInstances(template, collection, context, parentView) {
	return parentView.instantiate(template, collection, context);
}

////////////////////////////////////////////////////////////////////////////////
// Instantiate a template 0 or more times using the specified collection of
// data, appending any instances created to parentView or the parentNode of
// the template.
//
// The primary difference between this and instantiateTemplateOnce is that this
// function is responsible for iterating over a collection.  A logical
// consequence of this difference is that here is where the responsibility for
// maintaining the .explicit part of the frames stack resides.  Further
// consequences of this responsibility over iteration are the maintenance of the
// special variables (',', '@', '#', ...) and that the return value is an array
// instances instead of a single instance as it is for instantiateTemplateOnce.
/**@param {?Node}			template		The template to instantiate.
 * @param {?Array|?Object=}	collection		The collection to iterate over.
 * @param {?Array.<Frame>=}	context			The PARENT context to resolve references in.  Top-level invocations can/should leave this null or un-specified.
 * @param {?Node=}			parentView		The view to append template instances (views) to.
 * @param {?boolean=}		do_not_reveal_p	Embargo the instances after they are appended?
 * @return {Array.<Node>}					An array of views of collection items.
 */
function instantiateTemplate(template, collection, context, parentView, do_not_reveal_p) {
	var instances	= [];

	//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	template		= template ? resolve(template) : template;
	if(!template)	return instances;

	// Get the name used to refer to each model object in the collection
	var modelName = template.getAttribute('foreach');
	if(modelName.charAt(0) === '#') {		// support breakpoints in template boundary-elements
		debugger;
		modelName = modelName.substring(1);
	}

	//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	context = context || [new Frame(null, global)];

	//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	// Use template's parentNode as parentView if no parentView is passed
	// explicitly to instantiateTemplate call
	parentView		= (parentView
					   ? resolve(parentView)
					   : (template.parentForInstances ||template.parentNode));

	//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	// Use data specified in template if it is not passed explicitly to
	// instantiateTemplate call
	if(collection === undefined) {
		collection	= getCollectionForTemplate(template, context);
	}
	if(collection === undefined) {
		return instances;
	}
	if(!Array.isArray(collection)) {
		collection = Array(collection);		// make object into a single-element array
	}

	// Store the parent-view with the collection it contains
	if(collection.views === undefined) {	// prepare to store the view associated with the collection
		collection.views = [];
	}
	collection.views.push$(parentView);

	//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	// Store the collection as the model in the parentView in 2 ways.
	if(parentView) {
		if(parentView.collections === undefined) {
			parentView.collections = [];
		}
		parentView.collections.push$(collection.represents||collection);
	}
	if(parentView && parentView.model === undefined) {	// this is conditional so we don't clobber the value set in "instance.model = model" in instantiateTemplateOnce
		parentView.model = collection;
	}

	//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	// For each value in collection array:
	var j = 0;
	for(var i = 0; i < collection.length; i++) {
		var model = collection[i];

		// Put model into context using symbolic name assigned in the foreach="..." attribute
		if(modelName) {
			context[0].explicit[modelName] = model;
		}

		// If model is a primitive boolean, number or string, replace it with a
		// proxy for the purposes of further processing.  Do NOT put the
		// primitive into context[0].explicit as it will inhibit our ability to
		// do direct references.
		if(typeof(model) !== 'object') {
			switch(typeof(model)) {
				case 'string':	collection[i] = new String(model);	break;
				case 'number':	collection[i] = new Number(model);	break;
				case 'boolean':	collection[i] = new Boolean(model);	break;
			}
			model = collection[i];
		}

		// Create an instance of the template and add it to the list of instances
		var instance = instantiateTemplateOnce(template, model, context, collection, i);	//TODO// use collection.represents here??

		// Remove model from explicit context using the symbolic name assigned in the foreach="..." attribute
		if(modelName) {
			delete context[0].explicit[modelName];
		}

		if(!instance) continue;		//TODO// In this case pre/post script cancelled population of instance.  The question is, is it consistent with normal event handling semantics if we continue populating sibling instances?
		instances.push(instance);

		// Maybe append some instances (including this one) to the parent view
		if(parentView
		   && maxDeferredDOMInsertions	> 0
		   && (instances.length-j)		> maxDeferredDOMInsertions) {
			j += appendInstances(instances.slice(j), parentView, !do_not_reveal_p);
		}
	}

	// Append any un-appended instances to the parent view
	if(parentView) {
		appendInstances(instances.slice(j), parentView, !do_not_reveal_p);
	}

	return instances;
}

////////////////////////////////////////////////////////////////////////////////
// Create an instance of a template and its sub-templates using the data in
// a model object and a context.
//
// This does NOT put the instance in the DOM and should not use the DOM to
// connect with elements outside the template.  All of that should be done in
// "instantiateTemplate" via appendInstances(...).
/**@param {!Node}			template		The template to instantiate.
 * @param {!Object}			model			The model object to put into the new top Frame (for resolving unqualified references).
 * @param {?Array.<Frame>}	context			The PARENT context to resolve references in.
 * @param {?Array|?Object}	collection		The collection to iterate over.
 * @param {?number}			n				The number of items in the collection.
 * @return {Node}							The template instance (view) that was created.
 */
function instantiateTemplateOnce(template, model, context, collection, n) {
	var instance = template.cloneNode(true);		//	copy the template
	instance.template	= template;
	if(!template.instances) {
		template.instances = [];
	}
	template.instances.push(instance);

	// Tie the view (the instance) to its model (the JSON object) and vice-versa
	instance.model = model;
	if(typeof(model) === 'object') {
		if(!model.views
		   || !model.views.push) {
			model.views = Array();		//TODO// define this as a non-enumerable property of instance?
		}
		model.views.push$(instance);
	}
	if(onModelChange.bind) {	// browser support is lacking here
		instance.onModelChange = onModelChange.bind(instance);	// bind model change "event" handler
	}

	// Tie the instance to the collection that contains the model object and its
	// position in that collection, if any.
	instance.collection		= collection;
	instance.n				= n;

	// Incorporate the model into the frame
	context			= (context || newEmptyContext());
	context.unshift(new Frame({
		explicit:	context[0].explicit,
		model:		model,
		template:	template,
		instance:	instance,
		collection:	collection,
		n:			n
	}));

	// Replace variables with data from the model
	var subtemplates = substituteChildren.apply(instance, [context, instance]);

	// Run pre-instantiate-sub-templates-hook
	if(invokeHandler(instance, "pre")) {	// boolean return value determines if we 'continue' with this instance? (this pattern is consistent with other Javascript event handlers like 'click')
		// Instantiate sub-templates
		instance.subinstances = (instance.subinstances || []);
		var subinstances = instance.subinstances;
		for(var x = 0; x < subtemplates.length; x++) {
			var subtemplate		= subtemplates[x];

			// NOTE: Do NOT depend on instantiateTemplate to resolve the
			//	collection, it will easily get it wrong in the recursive
			//	template case when the model data does not have proper empty
			//	sub-containers put in place to terminate the recursion.
			var subcollection	= getCollectionForTemplate(subtemplate, context);
			if(!subcollection) {
				continue;
			}

			// instantiate and accumulate subtemplate instances
			var instances = instantiateTemplate((subtemplate.restartAtTemplate
												 ||subtemplate),
												subcollection,
												context,
												subtemplate.parentNode);
			subinstances.concat(instances);
		}

		// Run post-instantiate-sub-templates-hook
		if(!invokeHandler(instance, "post")) {	// boolean return value determines if we 'continue' with this instance? (this pattern is consistent with other Javascript event handlers like 'click')
			instance = undefined;
		}
	} else {
		// ... pre-instantiate-sub-templates-hook skipped subtemplate instantiation.
		instance = undefined;
	}

	// Remove the model and template from the stack of implicit context and templates
	context.shift();

	return instance;
}

////////////////////////////////////////////////////////////////////////////////
// Remove all of the things that cause an instance to be hidden as a template.
/**@param {!Node} instance	The template instance (view) to reveal. */
function revealInstance(instance) {
	instance.removeAttribute('foreach');
	instance.removeAttribute('in');
	instance.removeAttribute('of');

	// ... and attributes on instances instantiated recursively
	instance.removeAttribute('reapply');
	instance.removeAttribute('to');
	instance.className = instance.className.replace(/\btemplate\b/g,' ').trim();
}

// Append instances of a template to a view.  Returns a count of the number
// appended.
/**@param {!Array.<Nodes>}	instances		Template instances (views) to append to a parent view.
 * @param {!Node}			parentView		The view to append template instances (views) to.
 * @param {?boolean=}		reveal_p		Reveal the instances after they are appended?
 * @return {number}							The number of instances appended (not always == instasnces.length?!).
 */
function appendInstances(instances, parentView, reveal_p) {
	if(!Array.isArray(instances)) { instances = [instances]; }
	var i = 0;
	for(var j = 0; j < instances.length; j++) {
		if(!instances[j].parentNode) {
			if(reveal_p) {
				revealInstance(instances[j]);
			}
			parentView.appendChild(instances[j]);
			i++;
		}
	}
	return i;
}

// An event handler that should be called whenever a view's model data is changed
/**@this {!Node} The view object which had its model change. */
function onModelChange() {
	// remove this view from the list of views attached to this.model
	if(this.model && Array.isArray(this.model.views)) {
		this.model.views.removeAll(this);
	}

	// use this.template and this.model to re-create the view
	//TODO// save context before this happens so this can be re-created properly?
	var newInstance = instantiateTemplateOnce(this.template,
											  this.model,
											  (this.context
											   ||newEmptyContext()),
											  this.collection,
											  this.n);
	// replace this view with the new one
	if(this.parentNode) {
		this.parentNode.replaceChild(newInstance, this);
	}
}

/**@param {!Object} model The model object that changed. */
function sendModelChange(model) {
	if(!Array.isArray(model.views)) {
		return;
	}
	for(var i = 0; i < model.views.length; i++) {
		var view = model.views[i];
		if(view.onModelChange) {
			view.onModelChange();
		}
	}
}

////////////////////////////////////////////////////////////////////////////////
//						 ____       _            _
//						|  _ \ _ __(_)_   ____ _| |_ ___
//						| |_) | '__| \ \ / / _` | __/ _ \
//						|  __/| |  | |\ V / (_| | ||  __/
//						|_|   |_|  |_| \_/ \__,_|\__\___|
//
////////////////////////////////////////////////////////////////////////////////

//TODO// use connectors to populate the special delimiter variable ','
//-**@const */ var connectors	= ['pre', 'after-first', 'between-each', 'before-last', 'post'];
/**@const */ var connectors	= ['', ', ', ', ', ' and ', ''];

/**@param {!Node}			instance		The template instance (view) to invoke the handler on.
 * @param {!string}			handlerName		The name of the handler to invoke.
 * @return {boolean=}						Continue processing event?
 */
function invokeHandler(instance, handlerName) {
	var template = instance.template;

	// Invoke immediately if already bound
	if(instance[handlerName] && typeof(instance[handlerName]) === "function") {
		return instance[handlerName].call(instance);
	}

	bindHandler(instance, handlerName);

	// Invoke the just-bound handler on instance
	if(instance[handlerName]) {
		return instance[handlerName].call(instance);
	}

	// Nothing was bound, the default is to continue processing, so return true
	// in order to follow Javascript event handling/bubbling conventions.
	return true;
}

/**@param {!Node}			instance		The template instance (view) to invoke the handler on.
 * @param {!string}			handlerName		The name of the handler to invoke.
 */
function bindHandler(instance, handlerName) {
	var template = instance.template;

	// template has the handler as an attribute
	if(template.hasAttribute(handlerName)) {
		// compile the attribute and save it as a regular javascript property
		var handlerSourceCodeJS = template.getAttribute(handlerName);
		template.removeAttribute(handlerName);
		try {
			template[handlerName] = new Function("nullEvent", handlerSourceCodeJS);
			console.log("installed handler '"+handlerName+"': " + handlerSourceCodeJS);
		} catch(x) {
			console.log("exception while installing handler '"+handlerName+"': "
						+ handlerSourceCodeJS + "\n\nException: " + x);
		}
	}

	// instance does not have the handler bound to it
	if(!instance[handlerName] && template[handlerName]) {
		// bind a copy of handler to instance
		instance[handlerName] = template[handlerName].bind(instance);
	}
}

// Invoke the load "event" handlers on a tree of template instances and
// sub-instances.
/**@param {!Array.<Nodes>}	instances */
function invokeLoadHandlers(instances) {
	for(var i = 0; i < instances.length; i++) {
		var instance = instances[i];
		if(!instance.isLoaded) {
			invokeHandler(instance, 'load');
			instance.isLoaded = true;
		}
		if(instance.subinstances && instance.subinstances.length > 0) {
			invokeLoadHandlers(instance.subinstances, 'load');
		}
	}
}

////////////////////////////////////////////////////////////////////////////////
// Given the template, extract its 'in' or 'of' attribute and lookup the
// resulting variable's value if the attribute was a string.
//
// The sigils '*', '^', and '$' are used to tell the templating system to
// extract the values of an objects properties into an array ('*' just extracts
// values, '^' extracts the names of the properties and produces an array of
// {name:..., value:...} pairs) and sort the array respectively.
//
// If the attribute is not a string or array, an attempt may be made to convert
// it into an array, possibly by wrapping it as a 1-element array.
/**@hassideeffects								Updates to `context`, `template`, ...
 * @param {!Node}			template
 * @param {!Array.<Frame>}	context
 * @param {?string}			collectionAttributeName
 * @return {Array.<Object>}						The objects to be iterated over.
 */
function getCollectionForTemplate(template, context, collectionAttributeName) {
	var iterate_object_properties_p	= false;
	var collect_names_and_values_p	= false;
	var sorted_p					= false;
	var collectionName = (template.getAttribute(collectionAttributeName||'in')
						  || template.getAttribute('of')
						  || template.getAttribute('foreach'));
	var collection = [];

	if(template.hasAttribute('reapply')) {
		// When applying a template recursively, turn off recursive lookups for
		// locating the collection in context since it can easily cause infinite
		// recursion by locating the same collection in an ancestor frame.  This
		// surprises users who expect to be able to omit the collection entirely
		// from a model object deep in a recursive structure in order to stop
		// recursion.  They are surprised when the last-level ends up reapplying
		// to the data that was already covered by applying the template to the
		// second-to-last level.  If we made no attempt to stop recursion here,
		// then users would have to remember the ugly detail of ensuring that
		// leaf objects have empty collections to terminate recursion.

		// //TODO// To support mutually-recursive templates, this SHOULD search
		// up the context stack until it finds the most recent invocation of
		// this "same" template with the "same" collection.  Anything above that
		// point (what about at that point?) should be excluded from any search
		// for a collection.  The difficulty in implementing with this approach
		// is that the template gets cloned so we have no easy way of checking
		// for sameness.  Another confounding factor is that 'template' could be
		// the 'restartAtTemplate' instead of the 'reapply' stub.
		/** @const */ var previousInvocationLevel = 1;
		context = context.slice(0, previousInvocationLevel);
	}

	if(typeof(collectionName) === 'string') {
		while(collectionName.charAt(0) === '*'
			  || collectionName.charAt(0) === '^'
			  || collectionName.charAt(0) === '$') {
			if(collectionName.charAt(0) === '*') {
				iterate_object_properties_p = true;
			} else if(collectionName.charAt(0) === '^') {
				iterate_object_properties_p = true;
				collect_names_and_values_p	= true;
			} else if(collectionName.charAt(0) === '$') {
				sorted_p					= true;
			}
			collectionName = collectionName.substring(1);
		}

		if(collectionName === '' && Array.isArray(context.model)) {
			// //TODO// test ... So we can iterate over arrays-of-arrays...
			collection = context.model;
		} else {
			collection = resolveValueOfTemplateVariableCached(collectionName, context);
		}
	} else if(typeof(collectionName) === 'object') {
		collection = collectionName;
	} else if(typeof(collectionName) !== undefined) {
		// collectionName is a number or boolean
		collection = [collectionName];
	}

	if(collection && collection.debug) { debugger; } // support breakpoints in collections of models

	if(iterate_object_properties_p && !Array.isArray(collection)) {
		// extract each value from the object into an array
		var keys = Object.keys(collection) || [];
		if(sorted_p) keys.sort();

		var newCollection = [];
		newCollection.sorted_p = sorted_p;
		for(var i = 0; i < keys.length; i++) {
			if(!collect_names_and_values_p) {
				newCollection.push(collection[keys[i]]);
			} else {
				newCollection.push({name: keys[i], value: collection[keys[i]]});
			}
		}
		newCollection.represents = collection;	// retain a reference to the original collection
		collection = newCollection;
	} else if(sorted_p) {
		collection.sort();
	}

	return collection;
}

// Substitute all of the references to model and context variables in a template
// instance pointed to by 'this'.
/**@hassideeffects							Updates to data in `context` and `this`.
 * @param {!Array.<Frame>}	context			The context to resolve references in.
 * @param {!Node}			instance		The template instance (view) to substitute all of the references in.
 * @this {!Node}							//TODO// isn't this the same as instance???
 * @return {Array.<Node>}					The uninstantiated sub-templates
 */
function substituteChildren(context, instance) {
	var uninstantiatedTemplates	= [];
	var idAttribute				= undefined;
	var generatedIdAttribute	= undefined;

	// For some reason, childNodes does not contain ATTRIBUTE nodes
	for(var i = 0; i < this.attributes.length; i++) {
		var attribute = this.attributes[i];
		attribute.value = substituteInText(attribute.value, context);

		// Save IDs for later changing.  We do this so that we don't run into
		// javascript/DOM engine compatibility problems that may arise from
		// modifying the attributes of 'this' while iterating over the very same
		// collection.
		if(attribute.name === 'id') {
			idAttribute				= attribute;	// save it for removal so it doesn't conflict with id found in template
		} else if(attribute.name === 'genid') {
			generatedIdAttribute	= attribute;	// save it for "renaming"
		}

		if(attribute.name.charAt(0) === '#') {		// support breakpoints in any element of a template (non-standard XML to have '#' in attribute name?)
			debugger;
			this.removeAttribute(attribute.name);
		} else if(attribute.name.charAt(0) === ':') {// a generated attribute
			var newName = attribute.name.substring(1);
			this.setAttribute(newName, attribute.value);
			this.removeAttribute(attribute.name);
		}
	}

	// Change IDs on the element
	if(idAttribute) {
		this.removeAttribute(idAttribute.name);
	}
	if(generatedIdAttribute) {
		// "rename" the generated ID attribute
		this.setAttribute('id', generatedIdAttribute.value);
		this.removeAttribute(generatedIdAttribute.name);
	}

	// Substitute referenced values in TEXT and ELEMENT child nodes.
	for(var i = 0; i < this.childNodes.length; i++) {
		var child = this.childNodes[i];
		switch(child.nodeType) {
			case Node.TEXT_NODE:
				child.data = substituteInText(child.data, context);
				break;

			case Node.ELEMENT_NODE: {
				// Templates are elements which have 'foreach' attribute
				// OR both 'reapply' and 'to' attributes (a recursive
				// reference to an ancestor or external template).

				if(child.hasAttribute('foreach')) {
					// 'child' is a template, do not recurse right now but
					// process its id element if it has one.  We do this so
					// that templates without instances may still be located by
					// ID even when that ID must be dynamically generated.  This
					// occurs frequently in sub-templates that are instantiated
					// by user actions.
					uninstantiatedTemplates.push(child);
					if(child.hasAttribute('id')) {
						var value = substituteInText(child.getAttribute('id'), context);
						child.setAttribute('id', value);
					}
				} else if(child.hasAttribute('reapply')) {
					// BEWARE / BE AWARE:
					//	Copying current instances (exponential growth!)
					//	Placing result in wrong DOM subtree (hidden growth)
					//	This uninstantiated template may be returned as a
					//		grandchild template.

					//TODO// resolve references to "external" templates?

					// Recursive template invocation.  Resolve the reference to
					// ancestor template by finding one with a matching
					// 'foreach' name or the current template if reapply is
					// empty or '.'.
					if(!child.restartAtTemplate) {
						var templateName	= child.getAttribute('reapply');
						var template		= context[0].template;
						if(templateName !== '' && templateName !== '.') {
							for(var i = 0; i < context.length; i++) {
								var t = context[i].template;
								if(t.getAttribute('foreach') === templateName) {
									template = t;
									break;
								}
							}
						}
						child.restartAtTemplate = template;
						child.setAttribute('foreach',	templateName);
						child.setAttribute('in',		child.getAttribute('to'));
					}
					uninstantiatedTemplates.push(child);
				} else {
					// child is not itself a template *BUT* its descendants may be!
					var grandchildTemplates =
						substituteChildren.apply(child, arguments);

					uninstantiatedTemplates =
						uninstantiatedTemplates.concat(grandchildTemplates);

					child.instance = instance;		// save reference to the instance this element is a part of

					//TODO// if it was a script node, find or define corresponding function and run it with 'this' bound to our 'this'
				}
				break;
			}

			// already done in separate loop above
			case Node.ATTRIBUTE_NODE:				break;

			// leave entities in un-molested
			case Node.ENTITY_NODE:					break;
			case Node.ENTITY_REFERENCE_NODE:		break;

			// clear everything else
			case Node.CDATA_SECTION_NODE:			//TODO// leave CDATAs, NOTATIONs, and PROCESSING_INSTRUCTIONs?
			case Node.NOTATION_NODE:
			case Node.PROCESSING_INSTRUCTION_NODE:
			case Node.COMMENT_NODE:
			case Node.DOCUMENT_NODE:
			case Node.DOCUMENT_TYPE_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE:
			default:
				this.removeChild(child);
				break;
		}
	}
	return uninstantiatedTemplates;
}

////////////////////////////////////////////////////////////////////////////////
// Replace references to variable values in 'text' with their values found in
// the current context.
/**@const */ var referenceRE		= /@{([\[\]\/<>()*.:a-zA-Z0-9_,@#$]+?)}/g;	//TODO// make this more restrictive?
/**@const */ var erosionControlRE	= "[\\[\\]<>()*]*";	// Character class for: []<>()*		NOTE: do not use {}
/**@const */ var parseReferenceRE	= new RegExp("^"
	+"("+erosionControlRE+")"					// leading internal/external {,h,v?}space/element erosion control
	+"("										// relative reference clause
	+	"(\\/?)"								// absolute reference
	+	"(\\.*?)"								// up-references
	+")+"
	+"("										// explicitly-named reference clause
	+	"("										// non-special name
	+		"(?:[a-zA-Z0-9_][:a-zA-Z0-9_]*)"	// first non-empty component
	+		"(?:\.[a-zA-Z0-9_][:a-zA-Z0-9_]*)*"	// other non-empty components
	+	")?"
	+	"(?:\\.?([=,@#$]))?"					// special name
	+")"
	+"("+erosionControlRE+")"					// trailing internal/external {,h,v?}space/element erosion control
+"$");
/**@hassideeffects							Updates to data in `context`
 * @param {!string}			text			The text to find an substitute references in.
 * @param {!Array.<Frame>}	context			The context to resolve references in.
 * @return {!string}						The text with all substitutions performed.
 */
function substituteInText(text, context) {
	//TODO// Consider compiling chunks and saving somehow with the template or in a global structure and/or as a function.
	//			Using setAttribute to save the chunks with the elements can help preserve them, but it may not help for non-element objects
	//			Look into Object.defineProperty
	//		 The biggest advantage to compilation is probably the removal of regular expression parsing and execution overhead.
	//		 It is hard to optimize the element traversal and variable-lookup in the face of .cloneNode() (and the parallel process of model-traversal) since all of the saved references will become broken or point to shared instances that we really aren't interested in.
	//			Perhaps this could be done by calculating each elements index into the .children array and producing closures that incorporate multiple levels of these indexed references
	var chunks	= [];
	var i		= 0;

	// Find referenceRE, replacing each instance with the result of
	//	resolveValueOfTemplateVariableCached(...)
	for(var matches; matches = referenceRE.exec(text);) {
		/*-var parsedReference	= parseReferenceRE.exec(matches[1]);
		var parse			= {
			all:						parsedReference[0],
			leadingErosionControl:		parsedReference[1],
			relativeReferenceClause:	parsedReference[2],
			absoluteReferenceP:			parsedReference[3],
			relativeReference:			parsedReference[4],
			explicitReferenceName:		parsedReference[5],
			reference:					parsedReference[6],
			special:					parsedReference[7],
			trailingErosionControl:		parsedReference[8]
		}; // -*/
		var substitution = {
			start:		matches.index,
			end:		matches.index + matches[0].length,
			variable:	matches[1],
			value:		resolveValueOfTemplateVariableCached(matches[1], context)
		};
		chunks.push(text.substring(i, substitution.start));
		chunks.push(substitution.value);
		i = substitution.end;
	}
	return chunks.join("") + text.substring(i);
}


////////////////////////////////////////////////////////////////////////////////
// Resolve the value of a variable given a context, keeping the result in a
// cache for fast repeated access when the same exact name is used later.
/**@hassideeffects							Updates to data in `context`
 * @param {!string}			variableName	The name of the variable/attribute to lookup.
 * @param {!Array.<Frame>}	context			The context to resolve references in.
 * @return {?Object}						The value of the fully-resolved reference.
 */
function resolveValueOfTemplateVariableCached(variableName, context) {
	if(context[0].cache[variableName] === undefined) {
		context[0].cache[variableName] = resolveValueOfTemplateVariable(variableName, context);
	}
	return context[0].cache[variableName];
}

////////////////////////////////////////////////////////////////////////////////
// Resolve the value of a variable given a context.  The context is a set of
// frames of name to value mappings stored as Javascript objects.  The
// "top" (typically array index 0) layer of implicit mappings referred to with
// 'variableName' takes precedence over the explicitly-named layer found in
// 'frames.explicit'.  If the name cannot be found in the top or
// frames.explicit, then deeper layers are searched until a mapping is found or
// we run out of frames to look in.
/**@hassideeffects							Updates to data in `context`
 * @param {!string}			variableName	The name of the variable/attribute to lookup.
 * @param {!Array.<Frame>}	context			The context to resolve references in.
 * @return {?Object}						The value of the fully-resolved reference.
 */
function resolveValueOfTemplateVariable(variableName, context) {
	// @{name}		==> context[min(0,context.length-1)].lookup(name)
	// @{.name}		==> context[min(0,context.length-1)].lookup(name)
	// @{..name}	==> context[min(1,context.length-1)].lookup(name)
	// @{...name}	==> context[min(2,context.length-1)].lookup(name)
	// @{....name}	==> context[min(3,context.length-1)].lookup(name)
	// @{/name}		==> context[context.length-1].lookup(name)
	// @{/.name}	==> context[context.length-1].lookup(name)
	// @{/..name}	==> context[context.length-1].lookup(name)

	var rootFrameIdx	= context.length-1;
	var referencedFrame	= variableName.search(/[^.]/);	// counts number of leading '.'
	if(referencedFrame < 0) {
		referencedFrame = 0;
	}
	variableName = variableName.substring(referencedFrame);
	if(referencedFrame > 0) {
		referencedFrame--;
	}

	// Allow '/' to jump lookup to the "root" object
	if(variableName.charAt(0) === '/') {
		referencedFrame	= rootFrameIdx;
		variableName	= variableName.substring(1);
	}

	// Find the first object from the closest frame that has something associated with 'names[0]'
	var names = variableName.split('.');
	for(var i = referencedFrame; i < context.length; i++) {
		var value = context[i].lookup(names[0]);
		if(value !== undefined) {
			// Lookup subsequent names found from splitting variableName
			for(var j = 1; j < names.length; j++) {
				value = value[names[j]];
				if(j < names.length-1 && (value === undefined || value === null)) {
					return undefined;
				}
			}
			return value;
		}
	}
	return undefined;
}

/**@param		{?Frame}		frame	The frame to put into the context.
 * @return		{Array.<Frame>}			The new Context.
 */
function newContext(frame) { return [frame]; }

/**@return		{Array.<Frame>}			The new Context. */
function newEmptyContext() { return [new Frame(null, {})]; }

/**@param		{?Frame}		that	The frame to copy.
 * @param		{?Object}		model	The current model object for the new frame.
 * @constructor @final
 */
function Frame(that, model) {
	if(that !== undefined && typeof(that) === 'object') {
		// this is the "copy constructor"
		for(var p in that) {
			if(that.hasOwnProperty(p)) {
				this[p] = that[p];
			}
		}
	}
	this.cache		= {};						// setup by instantiateTemplateOnce
	this.explicit	= this.explicit||{};		// setup by instantiateTemplate
	this.model		= this.model||model;
	this.template	= this.template;			// setup by instantiateTemplateOnce
	this.instance	= this.instance;			// setup by instantiateTemplateOnce
	this.collection	= this.collection;			// setup by instantiateTemplate
	this.n			= this.n;					// setup by instantiateTemplate
	this.lookup		= function(name) {
		if(name === undefined) {
			return undefined;
		} else if(name.length === 1) {
			switch(name) {
				case '@': return 1 + this.n;
				case '$': return conditionalPluralSuffix(this.collection.length);
				case '#': return (this.collection ? this.collection.length : undefined);
				case ',': return (this.collection && this.n < this.collection.length ? ',' : '');
			}
			// fall through to general case
		} else if(name === 'length' || name === 'size' || name === '#') {
			return this.collection.length;
		}
		return	(this.cache[name]
				 || (this.cache[name] = this.model[name])
				 || (this.cache[name] = this.explicit[name]));
	};
}
window["Frame"] = Frame;

/**@param {!Object|!string|!number} objectOrNameOrId
 * @return {?Object}
 */
function resolve(objectOrNameOrId) {
	return (typeof(objectOrNameOrId) !== 'string'
			? objectOrNameOrId									// its already an object
			: (global[objectOrNameOrId]
			   ? global[objectOrNameOrId]						// object is stored directly as a global with the given name
			   : document.getElementById(objectOrNameOrId)))	// object is stored by its name but it is shadowed by an earlier JavaScript global so we have to treat the name as its ID
};

Object.defineProperty(Number.prototype, '$',	{ get: /** @this {number} */ function() { return conditionalPluralSuffix(this.valueOf()); } });
Object.defineProperty(Array.prototype, '$',		{ get: /** @this {Array}  */ function() { return conditionalPluralSuffix(this.length); } });
Object.defineProperty(Array.prototype, '#',		{ get: /** @this {Array}  */ function() { return this.length; } });
Object.defineProperty(Array.prototype, 'size',	{ get: /** @this {Array}  */ function() { return this.length; } });
Array.prototype["removeAll"] = function(obj) {		// Remove all instances of 'obj' from the array
	for(var i = this.indexOf(obj); i >= 0; i = this.indexOf(obj)) {
		this.splice(i, 1);
	}
};

Array.prototype["push$"] = function(obj) { if(this.indexOf(obj) < 0) { this.push(obj); } };

////////////////////////////////////////////////////////////////////////////////
// Localization functions.
//TODO//
/** @param {?number} n */
function conditionalPluralSuffix(n) {
	return (n !== undefined && n != 1 ? 's' : '');
	// Yes, in English, conditionalPluralize(0, 'cat') is probably 'cats'.
	// People say "there are 0 cats in the bag" or "there are no cats in the bag",
	// and not "there are 0 cat in the bag".  Confusingly, they might correctly
	// say instead "there is no cat in the bag" but would still not say
	// "there is 0 cat in the bag".
}

/** @param {!string} str */
function pluralFormOf(str) {
	return str + 's';
}
