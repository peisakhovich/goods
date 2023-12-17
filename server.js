const promise = require('bluebird'); // or any other Promise/A+ compatible library;
const initOptions = {
    promiseLib: promise // overriding the default (ES6 Promise);

};

const pgp = require('pg-promise')(initOptions);

const { GetCodeOfNode, GetNameOfNode } = require("./pga_common.js");

const cn = {
    host: '192.168.1.40', // 'localhost' is the default;
    port: 5432, // 5432 is the default;
    database: 'production',
    user: 'postgres',
    password: 'admin',

    allowExitOnIdle: true
};

const db = pgp(cn); // database instance;


const port = 8000;
const host = "192.168.1.40";

const express = require("express");
const path = require("path");
const morgan = require('morgan');

const app = express();

app.set("view engine", "ejs");

const createPath = (page) => path.resolve(__dirname, 'ejs-views', `${page}.ejs`);

app.listen(port, host, (error) => {
    error ? console.log(error) : console.log(`Server up on port: ${port} host: ${host} `)
});

app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

app.use(express.static("styles"));
app.use(express.urlencoded({ extended: false }));


app.get("/", (req, res) => {
    const title = "home";
    res.render(createPath('index'), { title });
});

/* This block to do makes query hierarchy to data base and views 
the tree of goods items and shows for edits detail its data */
app.get("/pg-goods_html", (req, res) => {
    const title = "GoodsTree";
    const Heder = "The goods tree of The cook-recept db";

    const HtmlString = '<div id="html1" > <ul><li>001-Напитки<ul></ul> </div>';

    const qstr = 'select goods.goods_hierarchy_html() as html_str';


    db.any(qstr, [])
        .then(dataset => {
            res.render(createPath('pg-goods_html'), { dataset, title, Heder });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres nut_data', error);
        });



});

/*  Shows detail of goods item */
app.get("/goods_show/:g_nood", (req, res) => {
    const title = "Show data of the goods item";

    const qstr = 'SELECT pname, pvalue, code'
        + ' FROM goods.goods_prop_trans WHERE code=$1';

    const g_nood = decodeURI(path.parse(req.path).base).trim();
    const Heder = "Данные товарной позиции - " + GetNameOfNode(g_nood);
    db.any(qstr, [GetCodeOfNode(g_nood)])
        .then(dataset => {
            res.render(createPath('pg-g_item_show_data'), { dataset, title, Heder });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres goods_data', error);
        });

});

/*  Edits detail of goods item */
app.get("/goods_edit/:g_nood", (req, res) => {
    const title = "Edit data of the goods item";

    var qstr = 'SELECT gh_id, gh_parent, gh_code, gh_isnode, gh_name '
        + ' FROM goods.goods_hierarchy where gh_code =$1';


    const g_nood = decodeURI(path.parse(req.path).base).trim();
    const Heder = "Изменение данных товарной позиции - " + GetNameOfNode(g_nood);

    db.any(qstr, [GetCodeOfNode(g_nood)])
        .then(gh_dataset => {

            qstr = 'SELECT gh_id as id , gh_code as code , gh_name as name'
                + ' FROM goods.goods_hierarchy where gh_isnode order by gh_code';
            db.any(qstr, [])
                .then(parent_dataset => {

                    // get up the date of goods detail 
                    qstr = 'SELECT g_id, g_fullname, gr_code, gu_account, gu_stock, gu_report, g_isnode'
                        + '	FROM goods.goods where g_id=$1';

                    db.any(qstr, [gh_dataset[0].gh_id])
                        .then(g_dataset => {
                            // get up the date group of goods 
                            qstr = 'SELECT gr_code AS code, gr_name FROM goods.goods_group ORDER BY gr_code';
                            db.any(qstr, [])
                                .then(group_dataset => {

                                    res.render(createPath('pg-g_item_edit_data'), { gh_dataset, parent_dataset, g_dataset, group_dataset, title, Heder });
                                })
                                .catch(error => {
                                    console.log('ERROR: on query to Postgres group of goods', error);
                                });
                        })
                        .catch(error => {
                            console.log('ERROR: on query to Postgres goods', error);
                        });
                })
                .catch(error => {
                    console.log('ERROR: on query to Postgres goods_hierarchy_parent', error);
                });

        })
        .catch(error => {
            console.log('ERROR: on query to Postgres goods_hierarchy', error);
        });

});

/*  Places data of the goods to database or Open form for edits data of the units of measure product */
app.post("/goods_edit/accept-data", (req, res) => {
    const { gh_id, gh_parent, g_isnode, g_fullname, Choice_Parent, gh_code, gh_isnode, gh_name, mode, add_properties, remove_properties, Choice_Group, Commit, Units } = req.body;
    var title = 'Accepted data';
    const post = {
        mode: mode,
        Choice_Parent: Choice_Parent.slice(Choice_Parent.indexOf(':') + 1),
        gh_id: gh_id,
        gh_code: gh_code,
        gh_isnode: (gh_isnode == 'on') ? true : false,
        gh_name: gh_name.trim(),
        add_properties: (add_properties == 'on') ? true : false,
        remove_properties: (remove_properties == 'on') ? true : false,
        Choice_Group: (typeof Choice_Group !== 'undefined') ? Choice_Group.slice(Choice_Group.indexOf(':') + 1) : '000',
        g_isnode: (g_isnode == 'on') ? true : false,
        g_fullname: (typeof g_fullname !== 'undefined') ? g_fullname.trim() : 'EmptyData',
        Commit: Commit,
        Units: Units
    };
    console.log(post);

    // Тут делаем комит в базу
    if (post.Commit == "Commit to DB") {
        qstr = 'SELECT goods.modify_gh( $1) AS result ';
        db.any(qstr, [post])
            .then(e_data => {

                res.render(createPath('post_accept'), { title, e_data });
            })
            .catch(error => {
                console.log('ERROR: on query to Postgres for entity date', error);
            });
    };
    //Тут вызывем форму для модификации единиц измерения
    if (post.Units == "Edit units") {

        // console.log(post);
        const goods = {
            id: post.gh_id,
            name: post.gh_name
        };
        const Heder = "Изменение единиц измерения у товарной позиции - " + goods.name;
        title = 'Edit units';
        qstr = 'SELECT gu_id, gu_name, gu_brutto, gu_netto, gu_parent, gu_parent_quantity, gu_isbase, gu_base_factor, g_id, gu_sign'
            + ' FROM goods.goods_units WHERE g_id=$1 ORDER BY gu_isbase DESC';
        db.any(qstr, [post.gh_id])
            .then(units_data => {

                res.render(createPath('pg-g_units_edit_data'), { title, Heder, units_data, goods });
            })
            .catch(error => {
                console.log('ERROR: on query to Postgres for entity units', error);
            });

    };

});
/*  Places data on the units of measure of the product */
app.post("/goods_edit/accept-units-data", (req, res) => {
    const { mode, id, RecCount, RecMode, gu_id, gu_name, gu_brutto, gu_netto, gu_parent, gu_parent_quantity, gu_isbase,
        gu_base_factor, gu_sign } = req.body;
    var title = 'Accepted units data';

    var UnitsData = undefined;
    var RecData = undefined;
    UnitsData = '[]';

    if (RecCount > 1) {
        UnitsData = '['
        for (let i = 0; i < RecCount; i++) {
            RecData = '{';
            RecData = RecData + '"RecMode":"' + RecMode[i] + '",';
            RecData = RecData + '"gu_id":"' + gu_id[i] + '",';
            RecData = RecData + '"gu_name":"' + gu_name[i].trim() + '",';
            RecData = RecData + '"gu_brutto":"' + gu_brutto[i] + '",';
            RecData = RecData + '"gu_netto":"' + gu_netto[i] + '",';
            RecData = RecData + '"gu_parent":"' + gu_parent[i] + '",';

            if (gu_parent_quantity[i].trim() !== '') { RecData = RecData + '"gu_parent_quantity":"' + gu_parent_quantity[i] + '",'; }
            else { RecData = RecData + '"gu_parent_quantity":"0",' };

            RecData = RecData + '"gu_base_factor":"' + gu_base_factor[i] + '",';
            RecData = RecData + '"gu_sign":"' + gu_sign[i].trim() + '"}';
            UnitsData = UnitsData + RecData;
            if (i < RecCount - 1) {
                UnitsData = UnitsData + ',';
            };

        };
        UnitsData = UnitsData + ']';
    };


    if (RecCount == 1) {
        UnitsData = '['

        RecData = '{';
        RecData = RecData + '"RecMode":"' + RecMode + '",';
        RecData = RecData + '"gu_id":"' + gu_id + '",';
        RecData = RecData + '"gu_name":"' + gu_name.trim() + '",';
        RecData = RecData + '"gu_brutto":"' + gu_brutto + '",';
        RecData = RecData + '"gu_netto":"' + gu_netto + '",';
        RecData = RecData + '"gu_parent":"' + gu_parent + '",';
        if (typeof gu_parent_quantity !== 'undefined') { RecData = RecData + '"gu_parent_quantity":"' + gu_parent_quantity + '",'; }
        else { RecData = RecData + '"gu_parent_quantity":"0",' };
        RecData = RecData + '"gu_base_factor":"' + gu_base_factor + '",';
        RecData = RecData + '"gu_sign":"' + gu_sign.trim() + '"}';
        UnitsData = UnitsData + RecData + ']';

    };

    const post = {
        mode: mode,
        id: id,
        RecCount: RecCount,
        UnitsData: JSON.parse(UnitsData)

    };

    console.log(post);

    qstr = 'SELECT goods.modify_gu( $1) AS result ';
    db.any(qstr, [post])
        .then(e_data => {
            console.log(e_data);
            res.render(createPath('post_accept'), { title, e_data });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });

});

app.get("/pg-form/:entry", (req, res) => {
    const title = "The Common Form For Edit";
    const Entity = decodeURI(path.parse(req.path).base).trim();
    const Heder = "Edit The ";

    var qstr = '';
    'SELECT to_id, to_name FROM goods.tech_operations';

    switch (Entity) {
        case 'TechOperation':
            qstr = 'SELECT to_id as e_id, to_name as e_name  FROM goods.tech_operations ORDER BY to_name';
            break;
        case 'RedistributionsPoints':
            qstr = 'SELECT rp_id as  e_id, rp_name as e_name	FROM goods.redistributions_points ORDER BY rp_name;';
            break;
        case 'WorkCenter':
            qstr = 'SELECT wc_id as  e_id, wc_name as e_name FROM goods.working_centers ORDER BY wc_name;';
            break;
        case 'Professions':
            qstr = 'SELECT pr_id as  e_id, pr_name as e_name FROM goods.professions ORDER BY pr_name;';
            break;
        default:
            qstr = "SELECT 'unknown id' as e_id, 'anknown name' as e_name ";

    };

    db.any(qstr, [])
        .then(e_data => {
            res.render(createPath('pg-form'), { e_data, title, Heder, Entity });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });

});

app.post("/pg-form/accept-data", (req, res) => {
    const { Choice_Item, New_newname, EntityName, mode } = req.body;
    const title = 'Accepted data';

    //console.log(Choice_Item);
    const post = {
        id: new Date().getMilliseconds(),
        mode: mode,
        Choice_Item: (typeof Choice_Item == 'undefined') ? 0 : Choice_Item.slice(Choice_Item.indexOf(':') + 1),
        New_newname: New_newname,
        EntityName: EntityName.replaceAll(/[ \r\t\n]/gi, ''),
        date: (new Date()).toLocaleDateString()

    };
    //console.log(post);
    // Тут делаем комит в базу

    qstr = 'SELECT goods.modify_simple_entity( $1,$2,$3,$4) AS result ';
    db.any(qstr, [post.EntityName, post.mode, post.Choice_Item, post.New_newname])
        .then(e_data => {

            res.render(createPath('post_accept'), { title, e_data });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });

});

/*  SpecificationsList: Edits detail of the specifications */

app.get("/specifications-list", (req, res) => {
    const title = "List of manufacturing specifications";

    var qstr = 'SELECT s_id, s_name, s_active, s_appropval_date, s_isapproval, s_comment, s_code, sp_rp_id, sc_count,r_count	FROM goods.specification_list  ';
    //+' WHERE 1=2';

    const Heder = "Спецификции производства ";
    db.any(qstr, [])
        .then(dataset => {

            qstr = ' SELECT rp_id , rp_name FROM goods.redistributions_points ORDER BY rp_name';
            db.any(qstr, [])
                .then(rp_dataset => {

                    res.render(createPath('pg-specifications-list'), { dataset, rp_dataset, title, Heder });

                })
                .catch(error => {
                    console.log('ERROR: on query to Postgres redistributions_points data', error);
                });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres specifications data', error);
        });

});

/*  Places data on the specification */
app.post("/specifications-list-accept-data", (req, res) => {
    const { RowData, AddFirst } = req.body;
    const title = 'Accepted data';
    const post = {

        AddFirst: (typeof AddFirst == 'undefined') ? 'undefined' : AddFirst,
        RowData: (RowData == '') ? JSON.parse('{"RecMode":"row unselected"}') : JSON.parse(RowData)
    };
    console.log(post);
    // Тут делаем комит в базу

    qstr = 'SELECT goods.modify_gs( $1) AS result ';
    db.any(qstr, [post])
        .then(e_data => {
            console.log(e_data);
            res.render(createPath('post_accept'), { title, e_data });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });


});

/*  ComponentsSpecifications: Edits detail of the specifications-components */
app.get("/specifications-components/:id", (req, res) => {
    const title = "Componetns of specifications";
    const SP_id = path.parse(req.path).base.replace(':', '');

    var qstr = 'SELECT s_id, s_name, s_active, s_appropval_date, s_isapproval, s_comment, s_code, sp_rp_id, sc_count,r_count 	FROM goods.specification_list'
        + ' WHERE s_id=$1 ORDER BY s_code';

    const Heder = "Состав спецификации ";
    db.any(qstr, [SP_id])
        .then(dataset => {

            qstr = ' SELECT rp_id , rp_name FROM goods.redistributions_points ORDER BY rp_name';
            db.any(qstr, [])
                .then(rp_dataset => {

                    qstr = 'SELECT gh_code, sc_id, s_id, g_id, gu_id, sc_quantity, sc_comment, sc_et_code, cisnode, cfullname, start_date'
                        + ' FROM goods.specification_components WHERE s_id=$1';
                    db.any(qstr, [SP_id])
                        .then(comp_dataset => {

                            qstr = " SELECT et_code, et_name FROM goods.entity_types WHERE et_entity='specification_component'"
                                + "ORDER BY et_code ";
                            db.any(qstr, [])
                                .then(et_dataset => {

                                    qstr = " SELECT gh_code AS ghcode ,g_id AS gid ,RPAD(gh_code,20,' ') ||':'|| g_fullname AS  gname ,  g_isnode AS gisnode"
                                        + " FROM goods.goods INNER JOIN goods.goods_hierarchy ON g_id=gh_id "
                                        + " WHERE g_id IN (SELECT DISTINCT g_id FROM goods.goods_units  ) "
                                        + " ORDER BY gh_code";

                                    db.any(qstr, [])
                                        .then(g_dataset => {

                                            qstr = "SELECT gu_id AS guid, gu_name AS guname, g_id AS goodid, gu_sign AS guisign"
                                                + " FROM goods.goods_units ORDER BY g_id";

                                            db.any(qstr, [])
                                                .then(u_dataset => {

                                                    res.render(createPath('pg-specifications-components'),
                                                        { comp_dataset, dataset, rp_dataset, et_dataset, g_dataset, u_dataset, title, Heder });
                                                })
                                                .catch(error => {
                                                    console.log('ERROR: on query to Postgres goods_units data', error);
                                                });
                                        })
                                        .catch(error => {
                                            console.log('ERROR: on query to Postgres goods data', error);
                                        });
                                })
                                .catch(error => {
                                    console.log('ERROR: on query to Postgres entity_types data', error);
                                });
                        })
                        .catch(error => {
                            console.log('ERROR: on query to Postgres specification_component data', error);
                        });
                })
                .catch(error => {
                    console.log('ERROR: on query to Postgres redistributions_points data', error);
                });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres specifications data', error);
        });

});


/*  Places data on the  specification components */
app.post("/specifications-components/accept-data", (req, res) => {
    const { RowData, AddFirstComp, SpID, RowDataComp } = req.body;
    const title = 'Accepted data';

    const post = {
        SpID: SpID,
        AddFirstComp: (typeof AddFirstComp == 'undefined') ? 'undefined' : AddFirstComp,
        RowDataComp: (typeof RowDataComp == 'undefined' || RowDataComp == '') ? JSON.parse('{"RecMode":"row unselected"}') : JSON.parse(RowDataComp)
    };
    console.log(post);
    // Тут делаем комит в базу

    qstr = 'SELECT goods.modify_gsc( $1) AS result ';
    db.any(qstr, [post])
        .then(e_data => {
            console.log(e_data);
            res.render(createPath('post_accept'), { title, e_data });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });


});


/*  Register RoutingsSpecifications: Edits detail of the specifications-routings */
app.get("/specifications-routings/:id", (req, res) => {
    const title = "routings of specification";
    const SP_id = path.parse(req.path).base.replace(':', '');

    var qstr = 'SELECT s_id, s_name, s_active, s_appropval_date, s_isapproval, s_comment, s_code, sp_rp_id, sc_count,r_count 	FROM goods.specification_list'
        + ' WHERE s_id=$1 ORDER BY s_code';

    const Heder = "Техкарты спецификации ";
    db.any(qstr, [SP_id])
        .then(dataset => {
            qstr = ' SELECT rp_id , rp_name FROM goods.redistributions_points ORDER BY rp_name';
            db.any(qstr, [])
                .then(rp_dataset => {
                    qstr = ' SELECT sr_r_id, sr_s_id, start_date, rs_count FROM goods.specification_routings_list'
                    +' WHERE sr_s_id=$1 ORDER BY start_date DESC';
                    db.any(qstr, [SP_id])
                        .then(sr_dataset => {
                            qstr = 'SELECT r_id,r_name,r_code FROM goods.routing';
                            db.any(qstr, [])
                                .then(r_dataset => {

                                    res.render(createPath('pg-specifications-routings'),
                                        { dataset, rp_dataset, sr_dataset, r_dataset, title, Heder });
                                })
                                .catch(error => {
                                    console.log('ERROR: on query to Postgres routing data', error);
                                });
                        })
                        .catch(error => {
                            console.log('ERROR: on query to Postgres specification_routing data', error);
                        });
                })
                .catch(error => {
                    console.log('ERROR: on query to Postgres redistributions_points data', error);
                });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres specifications data', error);
        });

});

/*  Places data on the register specifications-routings */
app.post("/specifications-routings/accept-data", (req, res) => {
    const { AddFirstSR, SpID, RowDataSR } = req.body;
    const title = 'Accepted data';

    const post = {
        SpID: SpID,
        AddFirstSR: (typeof AddFirstSR == 'undefined') ? 'undefined' : AddFirstSR,
        RowDataSR: (typeof RowDataSR == 'undefined' || RowDataSR == '') ? JSON.parse('{"RecMode":"row unselected"}') : JSON.parse(RowDataSR)
    };
    console.log(post);
    // Тут делаем комит в базу

    qstr = 'SELECT goods.modify_sr( $1) AS result ';
    db.any(qstr, [post])
        .then(e_data => {
            console.log(e_data);
            res.render(createPath('post_accept'), { title, e_data });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });


});

/*  Technological Routing List: Edits detail of the routings */
app.get("/routing-list", (req, res) => {
    const title = "List of technological maps";

    var qstr = 'SELECT r_id, r_name, r_isactive, r_approval_date, r_isapproval, r_comment, r_code, rs_count'
        + ' FROM goods.routing_list';


    const Heder = "Технологические карты производства";
    db.any(qstr, [])
        .then(dataset => {

            res.render(createPath('pg-routings-list'), { dataset, title, Heder });

        })
        .catch(error => {
            console.log('ERROR: on query to Postgres routings data', error);
        });

});

/*  Places data on the routing */
app.post("/routings-list-accept-data", (req, res) => {
    const { RowData, AddFirst } = req.body;
    const title = 'Accepted data';
    const post = {

        AddFirst: (typeof AddFirst == 'undefined') ? 'undefined' : AddFirst,
        RowData: (RowData == '') ? JSON.parse('{"RecMode":"row unselected"}') : JSON.parse(RowData)
    };
    console.log(post);
    // Тут делаем комит в базу

    qstr = 'SELECT goods.modify_r( $1) AS result ';
    db.any(qstr, [post])
        .then(e_data => {
            console.log(e_data);
            res.render(createPath('post_accept'), { title, e_data });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });


});

/*  Sheet of Technological Routing : Edits detail of the routing-sheet */
app.get("/routing-sheet/:id", (req, res) => {
    const title = "Technological Routing sheet";
    const Rout_id = path.parse(req.path).base.replace(':', '');

    var qstr = 'SELECT r_id, r_name, r_isactive, r_approval_date, r_isapproval, r_comment, r_code, rs_count FROM goods.routing_list'
        + ' WHERE r_id=$1 ORDER BY r_code';

    const Heder = "Маршрут технологической карты ";
    db.any(qstr, [Rout_id])
        .then(dataset => {

            qstr = ' SELECT wc_id, wc_name	FROM goods.working_centers ORDER BY wc_name';
            db.any(qstr, [])
                .then(wc_dataset => {

                    qstr = 'SELECT rs_id, r_id, rs_wc, rs_to, rs_number, rs_time ,rs_time_min , rs_comment,  rs_pr'
                    +' FROM goods.routing_sheet_list  WHERE r_id=$1 ORDER BY rs_number';
                    db.any(qstr, [Rout_id])
                        .then(rs_dataset => {

                            qstr = " SELECT to_id, to_name  FROM goods.tech_operations ORDER BY to_name ";
                            db.any(qstr, [])
                                .then(to_dataset => {

                                    qstr = "SELECT pr_id, pr_name 	FROM goods.professions ORDER BY pr_name ";
                                    db.any(qstr, [])
                                        .then(pr_dataset => {

                                            res.render(createPath('pg-routing-sheet'),
                                                { rs_dataset, dataset, wc_dataset, to_dataset, pr_dataset, title, Heder });

                                        })

                                        .catch(error => {
                                            console.log('ERROR: on query to Postgres professions data', error);
                                        });

                                })
                                .catch(error => {
                                    console.log('ERROR: on query to Postgres tech_operations data', error);
                                });

                        })
                        .catch(error => {
                            console.log('ERROR: on query to Postgres routing_sheet_list data', error);
                        });
                })
                .catch(error => {
                    console.log('ERROR: on query to Postgres working_centers data', error);
                });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres routing_list data', error);
        });

});

/*  Places data on the  routing-sheet*/
app.post("/routing-sheet/accept-data", (req, res) => {
    const { RowData, AddFirstItemSheet, RoutID, RowDataSheet } = req.body;
    const title = 'Accepted data';

    const post = {
        RoutID: RoutID,
        AddFirstItemSheet: (typeof AddFirstItemSheet == 'undefined') ? 'undefined' : AddFirstItemSheet,
        RowDataSheet: (typeof RowDataSheet == 'undefined' || RowDataSheet == '') ? JSON.parse('{"RecMode":"row unselected"}') : JSON.parse(RowDataSheet)
    };
    console.log(post);
    // Тут делаем комит в базу

    qstr = 'SELECT goods.modify_rs( $1) AS result ';
    db.any(qstr, [post])
        .then(e_data => {
            console.log(e_data);
            res.render(createPath('post_accept'), { title, e_data });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres for entity date', error);
        });


});



/*SR26 databese of Nutrient of Food*/
app.get("/pg-fn_table/:ndb_no", (req, res) => {
    const title = "Nutrient of Food";
    const Heder = "Содержание веществ в 100 граммах продукта.";

    const qstr =
        ' SELECT food_des.ndb_no,food_des.long_desc,nut_data.nutr_no,nutr_def.nutrdesc,nut_data.nutr_val,nutr_def.units'
        + ' FROM sr26.nutr_def'
        + ' JOIN (sr26.food_des '
        + ' JOIN sr26.nut_data ON food_des.ndb_no::text = nut_data.ndb_no::text) ON nutr_def.nutr_no::text = nut_data.nutr_no::text'
        + ' WHERE food_des.ndb_no = $1'
        + ' ORDER BY nutr_def.sr_order';

    const qstr1 = 'SELECT ndb_no,long_desc FROM sr26.food_des where ndb_no = $1';

    //const ndb_no='09003';
    const ndb_no = path.parse(req.path).base;

    db.any(qstr1, [ndb_no])
        .then(dataset1 => {
            //console.log(dataset1);

            db.any(qstr, [ndb_no])
                .then(dataset => {
                    res.render(createPath('pg-fn_table'), { dataset, title, Heder, dataset1 });
                })
                .catch(error => {
                    console.log('ERROR: on query to Postgres nut_data', error);
                });
        })
        .catch(error => {
            console.log('ERROR: on query to Postgres food_des', error);
        });




});

app.get("/pg-food_table", (req, res) => {
    const title = "pg_test_connect";
    const Heder = "Перечень продуктов USDA National Nutrient Database for Standard Reference - Release 26 ";

    const qstr = '  SELECT food_des.ndb_no,food_des.long_desc,fd_group.fdgrp_desc,fd_group.fdgrp_cd'
        + ' FROM sr26.food_des inner join sr26.fd_group on food_des.fdgrp_cd = fd_group.fdgrp_cd'
        + ' ORDER BY fd_group.fdgrp_cd,food_des.long_desc';


    db.any(qstr, [])
        .then(dataset => {

            res.render(createPath('pg-food_table'), { dataset, title, Heder });
            //console.log('DATA:', data); // print data;
        })
        .catch(error => {
            console.log('ERROR:', error); // print the error;
        });


});

/* Any */
app.get("/contacts", (req, res) => {
    const title = "contacts";
    const ContactsHeder = "Список контактов:";
    const contacts = [
        { name: 'Twiter', link: '#' },
        { name: 'Youtube', link: '#' },
        { name: 'email', link: '#' },
        { name: 'email1', link: '#' },
        { name: 'email2', link: '#' }
    ];

    res.render(createPath('contacts'), { contacts, title, ContactsHeder });
});

app.get("/about-as", (req, res) => {
    const title = "contacts";
    res.render(createPath('/contacts'), { title });
});

app.get("/posts/:id", (req, res) => {
    const title = "Userpost";
    //console.log(req);
    const post = {
        id: path.parse(req.path).base,
        text: 'Hello all my friens who studies this theme ',
        title: 'тема данного письма',
        date: '20.03.2023',
        author: 'PGA'
    };

    res.render(createPath('post'), { title, post });
});

app.get("/posts", (req, res) => {
    const title = "posts";
    const posts = [{
        id: '1',
        text: 'We are children of the big world. Its very pleasure  ',
        PostTitle: 'PostById',
        date: '20.03.2023',
        author: 'AnyUser1'
    },
    {
        id: '2',
        text: 'how many peoples had believe our faters ',
        PostTitle: 'PostById',
        date: '21.03.2023',
        author: 'PGA'
    }
    ];


    res.render(createPath('posts'), { title, posts });
});

app.post("/add-post", (req, res) => {
    const { title, author, text } = req.body;
    const post = {
        id: new Date().getMilliseconds(),
        text: text,
        title: title,
        date: (new Date()).toLocaleDateString(),
        author: author
    }
    res.render(createPath('post'), { title, post });
});

app.get("/add-post", (req, res) => {
    const title = "add-post";
    res.render(createPath('add-post'), { title });
});

app.use((req, res) => {

    res.status(404)
    const title = "error page";
    res.render(createPath('error'), { title });
});
