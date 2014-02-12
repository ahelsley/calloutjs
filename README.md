calloutjs
=========

A tiny but highly-functional client-side Javascript templating engine for JSON data/JavaScript data structures.

Notable limitations:
	Cannot create bare text-nodes (all instances of templates are elements).
	Cannot create a variable number of attributes or any attributes with
	any part of its name taken from a template variable.

Trivial Example:
	HTML (view):
		<ul><li id="ta" foreach="who" in="artists">@{who}</li></ul>

	JSON (model):
		var artists = ['Elvis Presley', 'Bon Jovi', 'U2'];

	Javascript initialization:
		instantiateTemplate(ta);

Example 2:
	HTML (view):
		<table>
			<tr id="tr" foreach="row" in="matrix">
				<td foreach="cell" in="row">
					@{cell}
				</td>
			</tr>
		</table>

	JSON (model):
		var matrix = [
			[1, 2, 3, 4],
			[5, 6, 7, 8],
			[9, 8, 7, 6],
			[5, 4, 3, 2]
		];

	Javascript initialization:
		instantiateTemplate(tr);

Example 3:
	JSON (model):
		var richArtists = [{
			first_name:	'Elvis', last_name: 'Presley',
			albums: {
				'Pot Luck': {
					title:	'Pot Luck',
					year:	1962,
					tracks: [2,2,2,2,2,2, 2,2,1,2,2,2]
				},
				'Red Mars': {
					title:	'Red Mars',
					year:	1963,
					tracks: [2]
				},
				'Blue Hawaii': {
					title: 'Blue Hawaii',
					year:	1961,
					tracks: []
				},
				...
			},
			...
		}];

	HTML (view):
		<ul id="tc">
			<li foreach="who" of="artists" genid="{@{last_name},@{first_name}}">
				@{.last_name}, @{who.first_name}
				<ul><li foreach="album" in="*$albums">
						@{who.first_name} created @{album.title}
						in @{year} containing
						@{album.tracks.length} track@{album.tracks.$}.
						<span foreach="n_minutes" in="album.tracks" title="@{who.first_name} @{...last_name}">
							<br />Track #@{@} of @{#} track@{$} is
							<b title="@{/last_name} @{who.first_name}">@{n_minutes}</b>
							minute@{n_minutes.$} long@{,}
						</span>
					</li>
				</ul>
			</li>
		</ul>

	Javascript initialization:
		instantiateTemplate(tc.querySelector('li'), null, richArtists);

Tree (Recursive) Example:
	HTML (view):
		<ul><li id="td" foreach="member" in="family">
				@{name}
				<ul><li reapply="member" to="children" /></ul>
			</li>
		</ul>

	JSON (model):
		var family = [{
			name: 'Caroline Bright',
			children: [{
				name: 'Willard Christopher Smith, Jr.',
				children:	[
					{name: 'Willard Christopher Smith III', children: []},
					{name: 'Jaden Smith', children: []},
					{name: 'Willow Camille Reign Smith', children: []}
				]
			},
			]
		}];

	Javascript initialization:
		instantiateTemplate(td);

Debugging:
	Some browsers support a 'debugger' keyword/operator.  In this case, you
	can jump to the debugger at a particular point in your template tree by
	inserting a '#' as the first letter of your 'foreach' attribute or the
	first letter of any attribute name.

//TODO// document the conceptual model of templates, models, instantiation, and
			stacking frames.  Finish documenting event handlers 'pre',
			'post', and 'load'.

//TODO// add modifying punctuation to allow concise ways of dealing with the
			motivating templating output patterns listed below.  Consider
			using .{next,previous}Sibling to implement.

//TODO// auto-quote values to prevent XSS

//TODO// Consider bash-like operators to support conditional output if an
			object is null or empty-string?:

			X:-Y	=> (X !== null || X === '' ? X  : Y)
			X+Y		=> (X === null || X !== ''  ? '' : Y)

Notice that the collections in the complex example above are referenced at
	the <li> level, but it is nice to push the actual object out of the
	template up to the "model" attribute of the enclosing <ul> so that there
	is a view and model for the list as a whole as well.

Notice the conventions for associating JSON data with templates:

	The foreach="ALIAS" attribute defines a local name which can be used to
		refer to each object from the collection as it is populating an
		instance.  This name is visible in the context of sub-templates so
		they can easily refer to parent-model values without resorting to
		lots of dots.  These names are silently shadowed by names of the
		current object being used to populate a template instance if there
		is a conflicting name in use.

		//TODO// some kind of developer mode should complain about shadowed names...

	The {in,of} attribute determines which named-collection from the
		"current" object gets iterated, whether that amounts to an object
		or array.

	By default, the global object serves as the "frame" object for the
		first template use.  In web browsers, this is the "window" object,
		where all global variables are defined.

Notice in the example above the ways in which model-values can be referenced
with variable names.  Here is a table of the names we are assigning to these
methods, the example that illustrates their use, and a description of how
they get resolved into a value:

	METHOD		EXAMPLE				DESCRIPTION
	------		-------				-----------
	Relative	@{...last_name}		Look "into" self/parent/ancestor/... model object to retrieve value.  In this example, look into "grandparent" object.
	Absolute	@{/last_name}		Look "into" the root ancestor model object to retrieve value.
	Named		@{who.first_name}	Look "into" a named-ancestor model object to retrieve value.
	Implicit	@{year}				Look at the current model object to retrieve value.
	Direct		@{n_minutes}		The current model *is* the value.

Special variables:
	@{[NAME.]$}	pluralize iff NAME references a collection with more than 1 item
	@{[NAME.]@}	the number in the collection which NAME is currently processing
	@{[NAME.]#}	the size in the collection NAME (length or Object.keys(NAME).length)
	@{[NAME.],}	delimit if current object is not the last or only object of its collection
	@{[NAME.]=}	the unquoted form of the value
	@{=JSEXPR}
	//TODO// indefinite article?

Motivating templating output patterns:
	white-space erosion left and/or right, internal and/or external, unconditional/conditional upon {,non-}existence of {,left,right,internal} content
x	<multiple>/<list>-item separator	/ output-if-not-last-item
	field-separator						/ output-if-immediate-siblings-not-empty
x	pluralization						/ output-if-rowcount-gt-1 + output-if-rowcount-eq-1
	implicit-output						/ output-if-not-same-as-last-row
	output-if-not-empty with/without prefix and/or suffix
	output-if-empty with/without prefix and/or suffix

IMPLEMENTATION NOTE:
Many functions below accept a 'context' parameter.  'context[i].explicit' is
where the objects bound to the variables named with 'foreach' are kept for
easy named-reference in sub-templates. 'context' itself is used for
resolving relative references.  It is an array of frames.  Frame 0 has
references to the most-recent model object being used to populate the
current instance of the current template ('context[0].model'), a reference
to the object used to track explicitly-named frame references
('context[0].explicit'), a cache for speeding up reference resolution in the
frame, and references to the instance and the template used to create the
instance during the lifetime of the frame.  Also included are references to
the collection (if any) from which the model object was retrieved during
template instantiation as well as the position of that object in the
collection.

Frame 1 holds information about the "parent" context in which frame 0 came
to be created.  Frame 2 is thus the "grand-parent" context of the parent
context, and so on until the root frame is reached.  Notice that when
references are resolved into model object values we look into model objects
before looking in the named frames.  This is in line with the principle of
obeying locally controlled and defined names before more distantly defined
ones.

Some functions use the 'cache' part of the frames stack.  This an object
where variable name-lookups are remembered for fast access later while in
the same template.

// Open questions:
//	Template elements can have pre and post instantiation as well as "load" hooks:
//		<li ...  pre="alert('about to instantiate subtemplates!')"
//				 post="alert('finished instantiating subtemplates!')"> ...
//

Revision History:
	DATE:		LOC:	CLOC:	COMMENTS:
	-----------	----	-----	---------
	2012-03-05: 523		906
	2012-03-09: 509		930
	2012-03-12: 771?	975
	2012-03-14: 537		937		Refactored context into array of Frame objs
	2012-03-20: 588		434		Added new invocation styles.  Fixed bug with proxies for primitives.
