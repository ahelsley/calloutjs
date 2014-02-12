calloutjs
=========

A tiny but highly-functional client-side Javascript templating engine for JSON data/JavaScript data structures.

Features:
---------
 -	Dynamic creation of DOM objects
 -	Relative, absolute, named, implicit, and direct [styles for references](#refstyles) to model attributes
 -	Retains references to the [template](#template)s that [instance](#instance)s are created from
 -	Retains of references to [model](#model) objects (bare JS Objects) in the view
 -	Retains of references to [view](#view) instances from the model objects
 -	Recursive template invocation via `<... reapply= ...>`.  Name the template to be `<... reapply= ...>`d...
 	- ... explicitly
 	- ... indirectly (using "relative" names, i.e.: `<... reapply=".." ...>`)
	- ... implicitly (by omitting the reference, `<... reapply= ...>` will reapply closest enclosing template)

Notable limitations:
--------------------
 -	Cannot create bare text-nodes (all instances of templates are elements).
 -	Cannot create a variable number of attributes or any attributes with
 -	any part of its name taken from a template variable.

Trivial Example:
----------------
 -	HTML (view):
 >		<ul><li id="ta" foreach="who" in="artists">@{who}</li></ul>

 -	JSON (model):
 >		var artists = ['Elvis Presley', 'Bon Jovi', 'U2'];

 -	Javascript initialization:
 >		instantiateTemplate(ta);

Example 2:
----------
 -	HTML (view):
 >		<table>
 >			<tr id="tr" foreach="row" in="matrix">
 >				<td foreach="cell" in="row">
 >					@{cell}
 >				</td>
 >			</tr>
 >		</table>

 -	JSON (model):
 >		var matrix = [
 >			[1, 2, 3, 4],
 >			[5, 6, 7, 8],
 >			[9, 8, 7, 6],
 >			[5, 4, 3, 2]
 >		];

 -	Javascript initialization:
 >		instantiateTemplate(tr);

Example 3:
----------
 -	JSON (model):
 >		var artists = [{
 >			first_name:	'Elvis', last_name: 'Presley',
 >			albums: {
 >				'Pot Luck': {
 >					title:	'Pot Luck',
 >					year:	1962,
 >					tracks: [2,2,2,2,2,2, 2,2,1,2,2,2]
 >				},
 >				'Red Mars': {
 >					title:	'Red Mars',
 >					year:	1963,
 >					tracks: [2]
 >				},
 >				'Blue Hawaii': {
 >					title: 'Blue Hawaii',
 >					year:	1961,
 >					tracks: []
 >				},
 >				...
 >			},
 >			...
 >		}];

 -	HTML (view):
 >		<ul id="tc">
 >			<li foreach="who" of="artists" genid="{@{last_name},@{first_name}}">
 >				@{.last_name}, @{who.first_name}
 >				<ul><li foreach="album" in="*$albums">
 >						@{who.first_name} created @{album.title}
 >						in @{year} containing
 >						@{album.tracks.length} track@{album.tracks.$}.
 >						<span foreach="n_minutes" in="album.tracks" title="@{who.first_name} @{...last_name}">
 >							<br />Track #@{@} of @{#} track@{$} is
 >							<b title="@{/last_name} @{who.first_name}">@{n_minutes}</b>
 >							minute@{n_minutes.$} long@{,}
 >						</span>
 >					</li>
 >				</ul>
 >			</li>
 >		</ul>

 -	Javascript initialization:
 >		instantiateTemplate(tc.querySelector('li'), null, artists);

### Naming:

Notice that the collections in the complex example above are referenced at
the `<li>` level, but it is nice to push the actual object out of the
template up to the "model" attribute of the enclosing `<ul>` so that there
is a view and model for the list as a whole as well.

Notice the conventions for associating JSON data with templates:

 -	The `foreach="ALIAS"` attribute defines a local name which can be used to
	refer to each object from the collection as it is populating an
	instance.  This name is visible in the context of sub-templates so
	they can easily refer to parent-model values without resorting to
	lots of dots.  These names are silently shadowed by names of the
	current object being used to populate a template instance if there
	is a conflicting name in use.

		//TODO// some kind of developer mode should complain about shadowed names...

 -	The {`in`,`of`} attribute determines which named-collection from the
	"current" object gets iterated, whether that amounts to an object
	or array.

 -	By default, the global object serves as the "frame" object for the
	first template use.  In web browsers, this is the "window" object,
	where all global variables are defined.

Notice in `Example 3` above the ways in which model-values can be referenced
with variable names.  Here is a table of the names we are assigning to these
methods, the example that illustrates their use, and a description of how
they get resolved into a value:

<a name="refstyles"></a>

<table>
	<thead><tr>	<th>Method</th>
			<th>Example</th>
			<th>Resolution Procedure</th>
		</tr>
	</thead>
	<tbody>
	<tr><td>Relative</td><td><code>@{...last_name}</code></td><td>Look "into" self/parent/ancestor/... model object to retrieve value.  In this example, look into "grandparent" object.  <em>NOTE:</em> In contrast to the UNIX convention of using two dots per "generation", this templating system uses only one dot per generation and omits the separating slashes altogether.</td></tr>
	<tr><td>Absolute</td><td><code>@{/last_name}</code></td><td>	Look "into" the root ancestor model object to retrieve value.</td></tr>
	<tr><td>Named</td><td>	 <code>@{who.first_name}</code></td><td>	Look "into" a named-ancestor model object to retrieve value (assumes `who` is not an attribute of the current model, otherwise `who` gets silently shadowed!).</td></tr>
	<tr><td>Implicit</td><td><code>@{year}</code></td><td>		Look at the current model object to retrieve value.</td></tr>
	<tr><td>Direct</td><td>	 <code>@{n_minutes}</code></td><td>	The current model *is* the value.</td></tr>
	</tbody>
</table>

Special "variables":
==================
Some references to variables are actually common transformations of model-attributes *or* pull out secondary collection attributes such as size and position (only during iteration) for use.

<table>
	<thead><tr>	<th>Syntax</th>
			<th>Description</th>
		</tr>
	</thead>
	<tbody>
	<tr><td><code>@{<var>[<kbd>NAME</kbd>.]</var>$}</code></td><td>pluralize iff NAME references a collection with more than 1 item</td></tr>
	<tr><td><code>@{<var>[<kbd>NAME</kbd>.]</var>@}</code></td><td>the number in the collection which NAME is currently processing</td></tr>
	<tr><td><code>@{<var>[<kbd>NAME</kbd>.]</var>#}</code></td><td>the size in the collection NAME (length or Object.keys(NAME).length)</td></tr>
	<tr><td><code>@{<var>[<kbd>NAME</kbd>.]</var>,}</code></td><td>delimit if current object is not the last or only object of its collection</td></tr>
	<tr><td><code>@{<var>[<kbd>NAME</kbd>.]</var>=}</code></td><td>the unquoted form of the value</td></tr>
	<tr><td><code>@{=JSEXPR}</code></td><td></td></tr>
	<tr><td colspan="2">//TODO// indefinite article?</td></tr>
	</tbody>
</table>

Iterating Over Non-`Array` Collections:
=======================================
The sigils `*`, `^`, and `$` are used to tell the templating system to extract the values of an objects properties into an array (`*` just extracts values, `^` extracts the names of the properties and produces an array of {name:..., value:...} pairs), and `$` sorts the array respectively.  The so-extracted values can then be used with the `<... foreach= ...>` iteration constructs.  They may be combined, though not all combinations are anticipated to be useful.

<table>
	<thead><tr>	<th>Syntax</th>
			<th>Description</th>
		</tr>
	</thead>
	<tbody>
	<tr><td><code>*@{<var>[<kbd>NAME</kbd>.]</var>}</code></td><td>Extract object-property values into an array.</td></tr>
	<tr><td><code>^@{<var>[<kbd>NAME</kbd>.]</var>}</code></td><td>Extract object-property names and values into an array of `{name:..., value:...}` pairs.</td></tr>
	<tr><td><code>$@{<var>[<kbd>NAME</kbd>.]</var>}</code></td><td>`$`ort</td></tr>
	</tbody>
</table>

Tree (Recursive) Example:
-------------------------
 -	HTML (view):
 >		<ul><li id="td" foreach="member" in="family">
 >				@{name}
 >				<ul><li reapply="member" to="children" /></ul>
 >			</li>
 >		</ul>

 -	JSON (model):
 >		var family = [{
 >			name: 'Caroline Bright',
 >			children: [{
 >				name: 'Willard Christopher Smith, Jr.',
 >				children:	[
 >					{name: 'Willard Christopher Smith III', children: []},
 >					{name: 'Jaden Smith', children: []},
 >					{name: 'Willow Camille Reign Smith', children: []}
 >				]
 >			},
 >			]
 >		}];

 -	Javascript initialization:
 >		instantiateTemplate(td);

Debugging:
==========
Some browsers support a `debugger` keyword/operator.  In this case, you
can jump to the debugger at a particular point in your template tree by
inserting a `#` as the first letter of your `foreach` attribute or the
first letter of any attribute name.

Glossary:
=========
<a name="template"></a>	<dt>template</dt>:	<dd>A template is ...</dd>
<a name="model"></a>	<dt>model</dt>:		<dd>Domain object model</dd>
<a name="instance"></a>	<dt>instance</dt>:	<dd>template + model</dd>
<a name="view"></a>	<dt>view</dt>:		<dd>template + model, as linked from the model</dd>
<a name="frame"></a>	<dt>frame</dt>:		<dd></dd>
<a name="hook"></a>	<dt>hook</dt>:		<dd></dd>
<a name="handler"></a>	<dt>handler</dt>:	<dd>see [hook](#hook)</dd>

Motivating templating output patterns:
======================================

<table>
	<thead>
		<tr>	<th>Implemented?</th>
			<th>Name</th>
			<th>Alternate Name</th>
		</tr>
	</thead>
	<tbody>
<tr><td> </td><td colspan="2">white-space erosion left and/or right, internal and/or external, unconditional/conditional upon {,non-}existence of {,left,right,internal} content</td></tr>
<tr><td>x</td><td>&lt;multiple&gt;/&lt;list&gt;-item separator	</td><td>output-if-not-last-item</td></tr>
<tr><td> </td><td>field-separator			</td><td>output-if-immediate-siblings-not-empty</td></tr>
<tr><td>x</td><td>pluralization				</td><td>output-if-rowcount-gt-1 + output-if-rowcount-eq-1</td></tr>
<tr><td> </td><td>implicit-output			</td><td>output-if-not-same-as-last-row</td></tr>
<tr><td> </td><td>output-if-not-empty with/without prefix and/or suffix</td></tr>
<tr><td> </td><td>output-if-empty with/without prefix and/or suffix</td></tr>
	</tbody>
</table>

IMPLEMENTATION NOTES:
=====================
Many functions below accept a `context` parameter.  `context[i].explicit` is
where the objects bound to the variables named with `foreach` are kept for
easy named-reference in sub-templates. `context` itself is used for
resolving relative references.  It is an array of frames.  Frame 0 has
references to the most-recent model object being used to populate the
current instance of the current template (`context[0].model`), a reference
to the object used to track explicitly-named frame references
(`context[0].explicit`), a cache for speeding up reference resolution in the
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

Some functions use the `cache` part of the frames stack.  This an object
where variable name-lookups are remembered for fast access later while in
the same template.

	// Open questions:
	//	Template elements can have pre and post instantiation as well as "load" hooks:
	//		<li ...  pre="alert('about to instantiate subtemplates!')"
	//				 post="alert('finished instantiating subtemplates!')"> ...
	//

Initial Revision History:
=========================
	DATE:		LOC:	CLOC:	COMMENTS:
	-----------	----	-----	---------
	2012-03-05: 523		906
	2012-03-09: 509		930
	2012-03-12: 771?	975
	2012-03-14: 537		937		Refactored context into array of Frame objs
	2012-03-20: 588		434		Added new invocation styles.  Fixed bug with proxies for primitives.
