
var data = Object();

data.basicMD = `#Quest Title
minplayers: 1
maxplayers: 2
author: Test

_Roleplay Card_

Stuff

And a line

_Another Card_

More stuff

* Decision

  _combat_ {"enemies": ["Skeleton Swordsman"]}

  * on win

    Victory!

    **end**

  * on lose

    Defeat!

    **end**

* Another decision
  that is multiple lines long

  More stuff

  **end**

* Still another decision!

  And a thing.

  **end**`;

data.basicXML = `<quest title="Quest Title" author="Test" minplayers="1" maxplayers="2">
    <roleplay title="Roleplay Card">
        <p>Stuff</p>
        <p>And a line</p>
    </roleplay>
    <roleplay title="Another Card">
        <p>More stuff</p>
        <choice text="Decision">
            <combat>
                <e>Skeleton Swordsman</e>
                <event on="win">
                    <roleplay title="">
                        <p>Victory!</p>
                    </roleplay>
                    <trigger>end</trigger>
                </event>
                <event on="lose">
                    <roleplay title="">
                        <p>Defeat!</p>
                    </roleplay>
                    <trigger>end</trigger>
                </event>
            </combat>
        </choice>
        <choice text="Another decision that is multiple lines long">
            <roleplay title="">
                <p>More stuff</p>
            </roleplay>
            <trigger>end</trigger>
        </choice>
        <choice text="Still another decision!">
            <roleplay title="">
                <p>And a thing.</p>
            </roleplay>
            <trigger>end</trigger>
        </choice>
    </roleplay>
</quest>`;

data.noHeaderMD = `_Roleplay Card_

stuff

**end**
`;

data.noHeaderError = `ERROR L0:
root block must be a quest header
URL: 404`;

data.emptyXML = `<quest title="Error">
    <roleplay></roleplay>
</quest>`;

data.emptyError = `ERROR L0:
No quest blocks found
URL: 404`;

export default data;