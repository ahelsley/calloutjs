- Document the conceptual model of templates, models, instantiation, and
			stacking frames.  Finish documenting event handlers 'pre',
			'post', and 'load'.

- Add modifying punctuation to allow concise ways of dealing with the
			motivating templating output patterns listed ****below****.  Consider
			using .{next,previous}Sibling to implement.

- Auto-quote values to prevent XSS

- Consider bash-like operators to support conditional output if an
			object is null or empty-string?:

 >			X:-Y	=> (X !== null || X === '' ? X  : Y)
 >			X+Y		=> (X === null || X !== ''  ? '' : Y)

