const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { ReportType } = require('@prisma/client');
const { Occupation } = require('@prisma/client');
const { ChurchType } = require('@prisma/client');
const prisma = new PrismaClient();

const development = async () => {
    await prisma.field.createMany({
        data: [
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Rondônia',
                designation: 'Porto Velho',
                abbreviation: 'AMEBRRO01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Amazonas',
                designation: 'Manaus',
                abbreviation: 'AMEBRAM01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Acre',
                designation: 'Rio Branco',
                abbreviation: 'AMEBRAC01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Mato Grosso do Sul',
                designation: 'Campo Grande',
                abbreviation: 'AMEBRMS01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Amapá',
                designation: 'Macapá',
                abbreviation: 'AMEBRAP01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Distrito Federal',
                designation: 'Brasília',
                abbreviation: 'AMEBRDF01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Roraima',
                designation: 'Boa Vista',
                abbreviation: 'AMEBRRR01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Mato Grosso',
                designation: 'Cuiabá',
                abbreviation: 'AMEBRMT01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Tocantins',
                designation: 'Palmas',
                abbreviation: 'AMEBRTO01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'São Paulo',
                designation: 'São Paulo',
                abbreviation: 'AMEBRSP01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Piauí',
                designation: 'Teresina',
                abbreviation: 'AMEBRPI01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Rio de Janeiro',
                designation: 'Jardim Bangu',
                abbreviation: 'AMEBRRJ01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Pará',
                designation: 'Belém',
                abbreviation: 'AMEBRPA01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Goiás',
                designation: 'Goiânia',
                abbreviation: 'AMEBRGO01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Rio Grande do Norte',
                designation: 'Natal',
                abbreviation: 'AMEBRRN01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Bahia',
                designation: 'Salvador',
                abbreviation: 'AMEBRBA01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Santa Catarina',
                designation: 'Florianópolis',
                abbreviation: 'AMEBRSC01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Maranhão',
                designation: 'São Luís',
                abbreviation: 'AMEBRMA01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Alagoas',
                designation: 'Maceió',
                abbreviation: 'AMEBRAL01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Rio Grande do Sul',
                designation: 'Porto Alegre',
                abbreviation: 'AMEBRRS01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Paraná',
                designation: 'Curitiba',
                abbreviation: 'AMEBRPR01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Minas Gerais',
                designation: 'Belo Horizonte',
                abbreviation: 'AMEBRMG01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Ceará',
                designation: 'Fortaleza',
                abbreviation: 'AMEBRCE01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Pernambuco',
                designation: 'Recife',
                abbreviation: 'AMEBRPE01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Paraíba',
                designation: 'João Pessoa',
                abbreviation: 'AMEBRPB01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Sergipe',
                designation: 'Aracaju',
                abbreviation: 'AMEBRSE01'
            },
            {
                continent: 'América',
                country: 'Brasil',
                state: 'Espírito Santo',
                designation: 'Vitória',
                abbreviation: 'AMEBRES01'
            },
        ]
    });
    console.log('Finished Fields...');


    // Offerors Families
    const fields = await prisma.field.findMany();
    let names = (fs.readFileSync('prisma/names.txt', 'utf-8')).split('\n');
    const personsPerField = 40;
    let offerorFamilyData = [];

    for (let i = 0; i < fields.length; i++) {
        for (let j = 0; j <= personsPerField; j++) {
            offerorFamilyData.push({
                representative: names.pop() || 'João',
                commitment: 'commitment',
                group: 'COMMUNITY',
                fieldId: fields[i].id,
            })
        }
    }

    await prisma.offerorFamily.createMany({
        data: offerorFamilyData,
    });
    console.log('Finished Offerors Families...');

    // Monthly Offers
    const years = [2020, 2021, 2022, 2023];
    let monthlyOffersData = [];

    for (let i = 0; i < fields.length; i++) {
        for (let j = 0; j < years.length; j++) {
            for (let k = 1; k <= 12; k++) {
                monthlyOffersData.push({
                    month: k,
                    year: years[j],
                    foodQnt: Math.ceil(Math.random() * 1000),
                    monetaryValue: Number((Math.random() * 1000).toFixed(2)),
                    othersQnt: Math.ceil(Math.random() * 1000),
                    fieldId: fields[i].id,
                })
            }
        }
    }

    await prisma.monthlyOffer.createMany({
        data: monthlyOffersData
    });
    console.log('Finished Monthly Offers...');

    // Report
    const semesterMonths = [5, 11];
    let reportsData = [];
    for (let i = 0; i < fields.length; i++) {
        for (let j = 0; j < years.length; j++) {
            for (let k = 1; k <= 12; k++) {
                reportsData.push({
                    title: `Relatório - ${fields[i].designation}`,
                    shortDescription: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.",
                    attachments: [`arquivo-${i + j + k}.pdf`],
                    month: k,
                    year: years[j],
                    type: ReportType.ORDINARY,
                    fieldId: fields[i].id,
                })
            }


            for (let l = 0; l < 2; l++) {
                reportsData.push({
                    title: `Relatório - ${fields[i].designation}`,
                    shortDescription: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.",
                    attachments: [`arquivo-${i + j}-s.pdf`],
                    month: semesterMonths[l],
                    year: years[j],
                    type: ReportType.SEMESTER,
                    fieldId: fields[i].id,
                })
            }

            reportsData.push({
                title: `Relatório - ${fields[i].designation}`,
                shortDescription: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.",
                attachments: [`arquivo-${i + j}-a.pdf`],
                year: years[j],
                type: ReportType.ANNUAL,
                fieldId: fields[i].id,
            })
        }
    }


    await prisma.report.createMany({
        data: reportsData
    });
    console.log('Finished Reports...');

    // volunteers
    const occupationKeys = Object.keys(Occupation);
    let volunteersData = [];
    names = (fs.readFileSync('prisma/names.txt', 'utf-8')).split('\n');
    for (let i = 0; i < fields.length; i++) {
        for (j = 0; j < Object.keys(Occupation).length; j++) {
            volunteersData.push({
                firstName: names.pop(),
                avatar: `arquivo-${i + j}.webp`,
                joinedDate: new Date(),
                occupation: occupationKeys[j],
                church: 'Igreja Nova Semente de Deus',
                priest: 'Pastor Júnior',
                observation: '',
                fieldId: fields[i].id,
            })
        }
    }

    await prisma.volunteer.createMany({
        data: volunteersData,
    });
    console.log('Finished Volunteers...');

    // Agenda
    const days = 28;
    let agendaData = [];
    for (let i = 1; i <= days; i++) {
        agendaData.push({
            title: `Agenda do Dia ${i}`,
            message: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
            date: new Date(`2023-07-${i}`),
        });
    }

    await prisma.agenda.createMany({
        data: agendaData,
    });
    console.log('Finished Agenda...');

    // Announcements
    await prisma.announcement.createMany({
        data: [
            {
                title: 'Anúncio Pequeno',
                message: 'Duis tempor, ipsum id facilisis elementum, lectus ante porta enim, sed vehicula mi leo vel eros. Sed quis risus metus. Integer elit mauris, auctor consectetur lectus id, aliquet ultricies erat.',
                attachments: ['image.jpg'],
            },
            {
                title: 'Anúncio Médio',
                message: `Quisque risus elit, semper et augue in, pulvinar scelerisque mi. Aliquam consequat quis lorem vitae auctor. Curabitur eget nisl non erat suscipit facilisis volutpat vulputate leo. Etiam lorem metus, porttitor eu ligula non, semper venenatis nisl. Mauris a libero et urna imperdiet ullamcorper a et magna. Integer non pulvinar massa. Quisque pharetra leo et dictum convallis. Duis ut lorem eu quam molestie vestibulum eget at felis. Donec a orci lacinia, ultricies eros sit amet, posuere mauris. Pellentesque mollis risus vitae risus rhoncus suscipit. Vestibulum vestibulum, turpis at condimentum cursus, ex orci laoreet tellus, vel consequat felis tellus nec nunc.`,
                attachments: [],
                fixed: true,
            },
            {
                title: 'Anúncio Grande',
                message: `Aenean facilisis auctor neque sed luctus. Ut non felis vitae mauris aliquam elementum ut a turpis. Phasellus sollicitudin nunc ex, id varius risus aliquam sit amet. Cras viverra sed tellus nec mattis. Etiam viverra rhoncus tristique. Curabitur eu augue molestie, pellentesque magna eu, feugiat ipsum. Suspendisse in mauris eget ante iaculis pellentesque. Etiam cursus massa a felis dictum, at congue urna interdum. Quisque nec ligula in tellus venenatis blandit non vitae neque. Nullam pretium turpis ante, a condimentum eros eleifend non. Phasellus dapibus sed lectus a fermentum. Cras et augue nulla.

                Fusce elementum at enim vel suscipit. Nulla cursus, mauris vel pellentesque convallis, turpis augue feugiat risus, non vehicula urna lectus at lectus. Praesent magna dui, vehicula sit amet velit non, porttitor congue odio. Donec tempus eget lacus elementum semper. Nulla est magna, euismod nec ipsum vitae, sollicitudin efficitur nunc. Sed ac porta nulla, ac posuere justo. Mauris tempor feugiat arcu, sed malesuada massa dictum at.`,
                attachments: ['file01.pdf', 'file02.pdf']
            }
        ]
    });
    console.log('Finished Announcements...');


    // Testimonials
    await prisma.testimonial.createMany({
        data: [
            {
                name: 'John Dope',
                text: `Dies iræ, dies illa
                Solvet sæclum in favilla
                Teste David cum Sibylla
                Quantus tremor est futurus
                Quando iudex est venturus
                Cuncta stricte discussurus`,
            }, {
                name: 'Joseph Matt',
                text: `Recordare, Iesu pie,
                Quod sum causa tuæ viæ:
                Ne me perdas illa die.`
            }
        ]
    });
    console.log('Finished Testimonials...');

    // Churches in Unity
    const churchesTypes = Object.keys(ChurchType);
    let churchesData = [];

    for (let i = 0; i < fields.length; i++) {
        for (j = 0; j < Object.keys(ChurchType).length; j++) {
            churchesData.push({
                name: `Igreja em Unidade - ${fields[i].designation}`,
                description: `here are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. All the Lorem Ipsum generators on the Internet tend to repeat predefined chunks as necessary, making this the first true generator on the Internet. It uses a dictionary of over 200 Latin words, combined with a handful of model sentence structures, to generate Lorem Ipsum which looks reasonable. The generated Lorem Ipsum is therefore always free from repetition, injected humour, or non-characteristic words etc.`,
                type: churchesTypes[j],
                fieldId: fields[i].id,
            });
        }
    }

    await prisma.church.createMany({
        data: churchesData,
    });
    console.log('Finished Churches in Unity...');

    // Welcomed Families
    let welcomedFamiliesData = [];
    names = (fs.readFileSync('prisma/names.txt', 'utf-8')).split('\n');

    for (let i = 0; i < fields.length; i++) {
        for (let j = 0; j <= personsPerField; j++) {
            welcomedFamiliesData.push({
                representative: names.pop() || 'João',
                observation: 'Lorem Ipsum Mene Ragnarok KEt',
                fieldId: fields[i].id,
            });
        }
    }

    await prisma.welcomedFamily.createMany({
        data: welcomedFamiliesData,
    });
    console.log('Finished Welcomed Families...');

    // Collaborators
    let collaboratorsData = [];
    const collaboratorPerField = 5;

    for (let i = 0; i < fields.length; i++) {
        for (let j = 0; j <= collaboratorPerField; j++) {
            collaboratorsData.push({
                title: `Colaborador - ${fields[i].designation}`,
                description: `ntrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of "de Finibus Bonorum et Malorum" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, "Lorem ipsum dolor sit amet..", comes from a line in section 1.10.32.`,
                fieldId: fields[i].id,
            });
        }
    }

    await prisma.collaborator.createMany({
        data: collaboratorsData,
    });
    console.log('Finished Collaborators...');

    // Recovery Houses
    let recoveryHousesData = [];
    const recoveryHousePerField = 3;

    for (let i = 0; i < fields.length; i++) {
        for (let j = 0; j <= recoveryHousePerField; j++) {
            recoveryHousesData.push({
                title: `Casa de Recuperação - ${fields[i].designation}`,
                description: `ntrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of "de Finibus Bonorum et Malorum" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, "Lorem ipsum dolor sit amet..", comes from a line in section 1.10.32.`,
                fieldId: fields[i].id,
            });
        }
    }

    await prisma.recoveryHouse.createMany({
        data: recoveryHousesData,
    });
    console.log('Finished Recovery Houses...');

}

module.exports = { development };